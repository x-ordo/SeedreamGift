param(
    [string]$Server = "103.97.209.141,7335",
    [string]$User = "dnflrhdwnghkdlxldsql",
    [string]$Password = "dnflrhdwnghkdlxld2024!@",
    [string]$Database = "WOWGIFT_DB"
)

Add-Type -AssemblyName "System.Data"

$connStr = "Server=$Server;Database=$Database;User Id=$User;Password=$Password;Encrypt=True;TrustServerCertificate=True;Connection Timeout=10"

function Invoke-Sql {
    param($Conn, $Sql)
    $cmd = $Conn.CreateCommand()
    $cmd.CommandText = $Sql
    $cmd.CommandTimeout = 30
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
    $dt = New-Object System.Data.DataTable
    [void]$adapter.Fill($dt)
    return $dt
}

$conn = New-Object System.Data.SqlClient.SqlConnection $connStr
try {
    $conn.Open()
    Write-Host "== Connected to $Server / $Database ==" -ForegroundColor Green

    Write-Host "`n-- @@VERSION --"
    (Invoke-Sql $conn "SELECT @@VERSION AS v").Rows[0].v

    Write-Host "`n-- DB info --"
    Invoke-Sql $conn @"
SELECT name, state_desc, recovery_model_desc, compatibility_level,
       (SELECT SUM(CAST(size AS BIGINT))*8/1024 FROM sys.master_files WHERE database_id = DB_ID('WOWGIFT_DB')) AS total_mb
FROM sys.databases WHERE name = 'WOWGIFT_DB'
"@ | Format-Table -AutoSize

    Write-Host "`n-- Default backup path --"
    (Invoke-Sql $conn "EXEC master..xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory'") | Format-Table -AutoSize

    Write-Host "`n-- Top 20 tables by rowcount --"
    Invoke-Sql $conn @"
SELECT TOP 20 s.name + '.' + t.name AS tbl, SUM(p.rows) AS rows
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY s.name, t.name
ORDER BY SUM(p.rows) DESC
"@ | Format-Table -AutoSize

    Write-Host "`n-- Table count / total rows --"
    Invoke-Sql $conn @"
SELECT
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) AS user_tables,
  (SELECT SUM(p.rows) FROM sys.tables t
     JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
     WHERE t.is_ms_shipped=0) AS total_rows
"@ | Format-Table -AutoSize

    Write-Host "`n-- xp_cmdshell status --"
    Invoke-Sql $conn "SELECT name, value_in_use FROM sys.configurations WHERE name = 'xp_cmdshell'" | Format-Table -AutoSize

} catch {
    Write-Error "FAILED: $_"
    exit 1
} finally {
    if ($conn.State -eq 'Open') { $conn.Close() }
}
