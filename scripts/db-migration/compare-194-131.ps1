Add-Type -AssemblyName 'System.Data'

function Invoke-Sql {
    param([string]$Server, [string]$Database, [string]$Sql)
    $cs = "Server=$Server;Database=$Database;User Id=dnflrhdwnghkdlxldsql;Password=dnflrhdwnghkdlxld2024!@;Encrypt=True;TrustServerCertificate=True;Connection Timeout=15"
    $c = New-Object System.Data.SqlClient.SqlConnection $cs
    $c.Open()
    try {
        $cmd = $c.CreateCommand()
        $cmd.CommandText = $Sql
        $cmd.CommandTimeout = 60
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
        $dt = New-Object System.Data.DataTable
        [void]$adapter.Fill($dt)
        return $dt
    } finally { $c.Close() }
}

foreach ($srv in '103.97.209.194,7335','103.97.209.131,7335') {
    Write-Host "`n====== $srv / SEEDREAM_GIFT_DB ======" -ForegroundColor Cyan

    Write-Host "`n-- Version"
    (Invoke-Sql $srv 'master' 'SELECT @@VERSION AS v').Rows | ForEach-Object { $_.v }

    Write-Host "`n-- DB size and recovery"
    Invoke-Sql $srv 'master' @"
SELECT d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level,
       (SELECT SUM(CAST(mf.size AS BIGINT))*8/1024 FROM sys.master_files mf WHERE mf.database_id = d.database_id) AS size_mb
FROM sys.databases d WHERE d.name = 'SEEDREAM_GIFT_DB'
"@ | Format-Table -AutoSize

    Write-Host "`n-- Files (mdf/ldf paths)"
    Invoke-Sql $srv 'master' @"
SELECT type_desc, name AS logical_name, physical_name, size*8/1024 AS size_mb
FROM sys.master_files WHERE database_id = DB_ID('SEEDREAM_GIFT_DB')
"@ | Format-Table -AutoSize

    Write-Host "`n-- Permissions on SEEDREAM_GIFT_DB"
    Invoke-Sql $srv 'SEEDREAM_GIFT_DB' @"
SELECT
  IS_ROLEMEMBER('db_owner') AS is_db_owner,
  IS_ROLEMEMBER('db_backupoperator') AS is_db_backupoperator,
  IS_ROLEMEMBER('db_datareader') AS is_db_datareader,
  IS_ROLEMEMBER('db_ddladmin') AS is_db_ddladmin,
  IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin,
  IS_SRVROLEMEMBER('dbcreator') AS is_dbcreator
"@ | Format-Table -AutoSize

    Write-Host "`n-- User tables + total rows"
    Invoke-Sql $srv 'SEEDREAM_GIFT_DB' @"
SELECT
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) AS user_tables,
  ISNULL((SELECT SUM(p.rows) FROM sys.tables t
     JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
     WHERE t.is_ms_shipped=0),0) AS total_rows
"@ | Format-Table -AutoSize

    Write-Host "-- Top 10 tables by rowcount"
    Invoke-Sql $srv 'SEEDREAM_GIFT_DB' @"
SELECT TOP 10 s.name + '.' + t.name AS tbl, SUM(p.rows) AS [rows]
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.is_ms_shipped=0
GROUP BY s.name, t.name
ORDER BY SUM(p.rows) DESC
"@ | Format-Table -AutoSize
}
