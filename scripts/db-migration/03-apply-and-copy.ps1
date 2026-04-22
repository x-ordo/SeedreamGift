. "$PSScriptRoot\lib-db.ps1"

$genDir = "$PSScriptRoot\generated"

function Invoke-SqlFile {
    param([string]$Server, [string]$Database, [string]$FilePath)
    $content = Get-Content -Raw -Path $FilePath -Encoding UTF8
    $batches = $content -split '(?mi)^\s*GO\s*\r?$'
    $c = New-Conn $Server $Database
    $c.Open()
    $ok = 0; $fail = 0
    try {
        foreach ($batch in $batches) {
            if ([string]::IsNullOrWhiteSpace($batch)) { continue }
            try {
                $cmd = $c.CreateCommand()
                $cmd.CommandText = $batch
                $cmd.CommandTimeout = 180
                [void]$cmd.ExecuteNonQuery()
                $ok++
            } catch {
                $fail++
                $msg = $_.Exception.Message.Split([Environment]::NewLine)[0]
                Write-Host "  [ERR] batch: $msg" -ForegroundColor Red
                $snippet = $batch.Substring(0, [Math]::Min(160, $batch.Length)).Replace("`r`n", ' | ')
                Write-Host "    snippet: $snippet" -ForegroundColor DarkGray
            }
        }
    } finally { $c.Close() }
    return @{ ok = $ok; fail = $fail }
}

function Copy-TableData {
    param([string]$Schema, [string]$Table)
    $srcCs = "Server=$Script:SRC;Database=$Script:DB;User Id=$Script:USR;Password=$Script:PWD;Encrypt=True;TrustServerCertificate=True;Connection Timeout=15"
    $dstCs = "Server=$Script:DST;Database=$Script:DB;User Id=$Script:USR;Password=$Script:PWD;Encrypt=True;TrustServerCertificate=True;Connection Timeout=15"

    $src = New-Object System.Data.SqlClient.SqlConnection $srcCs
    $src.Open()
    try {
        $cmd = $src.CreateCommand()
        $cmd.CommandText = "SELECT * FROM [$Schema].[$Table]"
        $cmd.CommandTimeout = 300
        $reader = $cmd.ExecuteReader()
        $opts = [System.Data.SqlClient.SqlBulkCopyOptions]::KeepIdentity -bor [System.Data.SqlClient.SqlBulkCopyOptions]::KeepNulls
        $bulk = New-Object System.Data.SqlClient.SqlBulkCopy($dstCs, $opts)
        $bulk.DestinationTableName = "[$Schema].[$Table]"
        $bulk.BulkCopyTimeout = 300
        $bulk.BatchSize = 1000
        try { $bulk.WriteToServer($reader) }
        finally { $reader.Close(); $bulk.Close() }
    } finally { $src.Close() }
}

Write-Host "`n=== PHASE A : apply CREATE TABLE to 131 ===" -ForegroundColor Cyan
$r = Invoke-SqlFile $Script:DST $Script:DB "$genDir\01-tables.sql"
Write-Host "  tables batches ok=$($r.ok) fail=$($r.fail)" -ForegroundColor Green
if ($r.fail -gt 0) { Write-Host "STOP: table creation failed" -ForegroundColor Red; exit 1 }

$c = (Invoke-QueryObjects $Script:DST $Script:DB "SELECT COUNT(*) AS n FROM sys.tables WHERE is_ms_shipped=0")[0].n
Write-Host "  131 user_tables = $c (expected 39)" -ForegroundColor Green

Write-Host "`n=== PHASE B : SqlBulkCopy data 194 -> 131 ===" -ForegroundColor Cyan
$tables = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name, t.name AS table_name,
       ISNULL((SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)),0) AS src_rows
FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name
"@

$total = 0; $mismatch = 0
foreach ($t in $tables) {
    $rows = [int64]$t.src_rows
    if ($rows -eq 0) {
        Write-Host ("  [skip] [{0}].[{1}] (0 rows)" -f $t.schema_name, $t.table_name) -ForegroundColor DarkGray
        continue
    }
    try {
        Copy-TableData -Schema $t.schema_name -Table $t.table_name
        $n = (Invoke-QueryObjects $Script:DST $Script:DB "SELECT COUNT_BIG(*) AS n FROM [$($t.schema_name)].[$($t.table_name)]")[0].n
        if ([int64]$n -eq $rows) {
            Write-Host ("  [OK]  [{0}].[{1}]  rows={2}" -f $t.schema_name, $t.table_name, $rows) -ForegroundColor Green
            $total += $rows
        } else {
            Write-Host ("  [MISMATCH] [{0}].[{1}]  src={2} dst={3}" -f $t.schema_name, $t.table_name, $rows, $n) -ForegroundColor Yellow
            $mismatch++
        }
    } catch {
        Write-Host ("  [ERR] [{0}].[{1}] : {2}" -f $t.schema_name, $t.table_name, $_.Exception.Message.Split([Environment]::NewLine)[0]) -ForegroundColor Red
    }
}
Write-Host "`n  Total rows copied : $total  |  mismatches : $mismatch" -ForegroundColor Cyan

foreach ($p in @(
    @{ name='CHECK';   file='02-checks.sql'  },
    @{ name='INDEX';   file='03-indexes.sql' },
    @{ name='FK';      file='04-fks.sql'     },
    @{ name='MODULES'; file='05-modules.sql' }
)) {
    Write-Host "`n=== PHASE C : apply $($p.name) ===" -ForegroundColor Cyan
    $r = Invoke-SqlFile $Script:DST $Script:DB "$genDir\$($p.file)"
    Write-Host "  $($p.name) batches ok=$($r.ok) fail=$($r.fail)" -ForegroundColor Green
}

Write-Host "`n=== PHASE D : verify ===" -ForegroundColor Cyan

$metricSql = @"
SELECT 'user_tables' AS metric, COUNT(*) AS cnt FROM sys.tables WHERE is_ms_shipped=0
UNION ALL SELECT 'pk',  COUNT(*) FROM sys.key_constraints WHERE type='PK'
UNION ALL SELECT 'uq',  COUNT(*) FROM sys.key_constraints WHERE type='UQ'
UNION ALL SELECT 'fk',  COUNT(*) FROM sys.foreign_keys
UNION ALL SELECT 'check', COUNT(*) FROM sys.check_constraints
UNION ALL SELECT 'default_c', COUNT(*) FROM sys.default_constraints
UNION ALL SELECT 'nc_index', COUNT(*) FROM sys.indexes WHERE index_id>1 AND is_primary_key=0 AND is_unique_constraint=0 AND type_desc='NONCLUSTERED'
UNION ALL SELECT 'procs', COUNT(*) FROM sys.procedures WHERE is_ms_shipped=0
UNION ALL SELECT 'funcs', COUNT(*) FROM sys.objects WHERE type IN ('FN','IF','TF') AND is_ms_shipped=0
UNION ALL SELECT 'total_rows', ISNULL(SUM(p.rows),0) FROM sys.partitions p JOIN sys.tables t ON t.object_id=p.object_id WHERE p.index_id IN (0,1) AND t.is_ms_shipped=0
"@
Write-Host "`n-- 131 (destination):"
Invoke-QueryObjects $Script:DST $Script:DB $metricSql | Format-Table -AutoSize
Write-Host "-- 194 (source):"
Invoke-QueryObjects $Script:SRC $Script:DB $metricSql | Format-Table -AutoSize
