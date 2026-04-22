Add-Type -AssemblyName 'System.Data'

function Invoke-Sql {
    param([string]$Server, [string]$Database, [string]$Sql)
    $cs = "Server=$Server;Database=$Database;User Id=dnflrhdwnghkdlxldsql;Password=dnflrhdwnghkdlxld2024!@;Encrypt=True;TrustServerCertificate=True;Connection Timeout=10"
    $c = New-Object System.Data.SqlClient.SqlConnection $cs
    $c.Open()
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = $Sql
        $cmd.CommandTimeout = 30
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
        $dt = New-Object System.Data.DataTable
        [void]$adapter.Fill($dt)
        return $dt
    } finally { $c.Close() }
}

foreach ($srv in '103.97.209.141,7335','103.97.209.131,7335') {
    Write-Host "`n====== $srv ======" -ForegroundColor Cyan
    Write-Host "-- @@VERSION"
    (Invoke-Sql $srv 'master' 'SELECT @@VERSION AS v').Rows[0].v
    Write-Host "`n-- Databases visible to this login"
    Invoke-Sql $srv 'master' @"
SELECT d.name, d.state_desc, d.recovery_model_desc,
       HAS_DBACCESS(d.name) AS has_access,
       (SELECT SUM(CAST(mf.size AS BIGINT))*8/1024 FROM sys.master_files mf WHERE mf.database_id = d.database_id) AS size_mb
FROM sys.databases d
ORDER BY d.name
"@ | Format-Table -AutoSize
    Write-Host "-- Current login info"
    Invoke-Sql $srv 'master' "SELECT SUSER_SNAME() AS login_name, IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin, IS_SRVROLEMEMBER('dbcreator') AS is_dbcreator" | Format-Table -AutoSize
}
