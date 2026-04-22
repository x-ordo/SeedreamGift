Add-Type -AssemblyName 'System.Data'

$Script:SRC = '103.97.209.194,7335'
$Script:DST = '103.97.209.131,7335'
$Script:DB  = 'WOWGIFT_DB'
$Script:USR = 'dnflrhdwnghkdlxldsql'
$Script:PWD = 'dnflrhdwnghkdlxld2024!@'

function New-Conn {
    param([string]$Server, [string]$Database = 'master')
    $cs = "Server=$Server;Database=$Database;User Id=$Script:USR;Password=$Script:PWD;Encrypt=True;TrustServerCertificate=True;Connection Timeout=15"
    New-Object System.Data.SqlClient.SqlConnection $cs
}

function Invoke-Query {
    param([string]$Server, [string]$Database, [string]$Sql, [int]$TimeoutSec = 120)
    $c = New-Conn $Server $Database
    $c.Open()
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = $Sql
        $cmd.CommandTimeout = $TimeoutSec
        $ad = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
        $dt = New-Object System.Data.DataTable
        [void]$ad.Fill($dt)
        return $dt
    } finally { $c.Close() }
}

function Invoke-QueryObjects {
    param([string]$Server, [string]$Database, [string]$Sql, [int]$TimeoutSec = 120)
    $c = New-Conn $Server $Database
    $c.Open()
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = $Sql
        $cmd.CommandTimeout = $TimeoutSec
        $reader = $cmd.ExecuteReader()
        $cols = @()
        for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
        $rows = New-Object System.Collections.ArrayList
        while ($reader.Read()) {
            $obj = [ordered]@{}
            for ($i = 0; $i -lt $cols.Count; $i++) {
                $v = $reader.GetValue($i)
                if ($v -is [System.DBNull]) { $v = $null }
                $obj[$cols[$i]] = $v
            }
            [void]$rows.Add([PSCustomObject]$obj)
        }
        $reader.Close()
        return ,@($rows.ToArray())
    } finally { $c.Close() }
}

function Invoke-NonQuery {
    param([string]$Server, [string]$Database, [string]$Sql, [int]$TimeoutSec = 120)
    $c = New-Conn $Server $Database
    $c.Open()
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = $Sql
        $cmd.CommandTimeout = $TimeoutSec
        return $cmd.ExecuteNonQuery()
    } finally { $c.Close() }
}

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK]  $msg" -ForegroundColor Green }
function Write-Warn2{ param($msg) Write-Host "  [WARN]$msg" -ForegroundColor Yellow }
function Write-Err2 { param($msg) Write-Host "  [ERR] $msg" -ForegroundColor Red }
