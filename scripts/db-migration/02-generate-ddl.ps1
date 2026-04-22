. "$PSScriptRoot\lib-db.ps1"

$outDir = "$PSScriptRoot\generated"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function Format-SqlType {
    param($type, $max_length, $precision, $scale)
    switch ($type) {
        { $_ -in 'nvarchar','nchar' } {
            if ($max_length -eq -1) { return "$type(MAX)" }
            return "$type($($max_length/2))"
        }
        { $_ -in 'varchar','char','binary','varbinary' } {
            if ($max_length -eq -1) { return "$type(MAX)" }
            return "$type($max_length)"
        }
        'decimal'        { return "decimal($precision,$scale)" }
        'numeric'        { return "numeric($precision,$scale)" }
        'datetime2'      { return "datetime2($scale)" }
        'datetimeoffset' { return "datetimeoffset($scale)" }
        'time'           { return "time($scale)" }
        'float'          { if ($precision -gt 0) { return "float($precision)" } else { return "float" } }
        default          { return $type }
    }
}

Write-Step "메타데이터 수집 (194)"

$columns = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name,
       t.name AS table_name,
       c.column_id,
       c.name AS column_name,
       ty.name AS type_name,
       c.max_length, c.precision, c.scale,
       c.is_nullable,
       c.is_identity,
       c.collation_name,
       ic.seed_value, ic.increment_value,
       dc.name  AS default_name,
       dc.definition AS default_def
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id
"@
Write-OK "columns rows = $($columns.Count)"

$pkUq = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name, t.name AS table_name, kc.name AS constraint_name,
       CAST(kc.type AS varchar(2)) AS kc_type,
       i.type_desc, c.name AS column_name, ic.key_ordinal, ic.is_descending_key
FROM sys.key_constraints kc
JOIN sys.tables t ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.indexes i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type IN ('PK','UQ') AND t.is_ms_shipped = 0
ORDER BY s.name, t.name, kc.name, ic.key_ordinal
"@
Write-OK "pk/uq rows = $($pkUq.Count)"

$checks = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name, t.name AS table_name, cc.name AS constraint_name, cc.definition
FROM sys.check_constraints cc
JOIN sys.tables t ON t.object_id = cc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, cc.name
"@
Write-OK "checks rows = $($checks.Count)"

$indexes = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name, t.name AS table_name, i.name AS index_name,
       i.type_desc, CAST(i.is_unique AS int) AS is_unique, i.filter_definition,
       c.name AS column_name, ic.key_ordinal,
       CAST(ic.is_descending_key AS int) AS is_descending_key,
       CAST(ic.is_included_column AS int) AS is_included_column
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE t.is_ms_shipped = 0
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND i.type_desc <> 'HEAP'
ORDER BY s.name, t.name, i.name, ic.is_included_column, ic.key_ordinal
"@
Write-OK "indexes rows = $($indexes.Count)"

$fks = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT fk.name AS fk_name,
       ps.name AS parent_schema, pt.name AS parent_table, pc.name AS parent_column,
       rs.name AS ref_schema,    rt.name AS ref_table,    rc.name AS ref_column,
       fkc.constraint_column_id,
       fk.delete_referential_action_desc AS on_delete,
       fk.update_referential_action_desc AS on_update,
       CAST(fk.is_disabled AS int) AS is_disabled
FROM sys.foreign_keys fk
JOIN sys.tables pt  ON pt.object_id = fk.parent_object_id
JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
JOIN sys.tables rt  ON rt.object_id = fk.referenced_object_id
JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
ORDER BY fk.name, fkc.constraint_column_id
"@
Write-OK "fks rows = $($fks.Count)"

$modules = Invoke-QueryObjects $Script:SRC $Script:DB @"
SELECT s.name AS schema_name, o.name AS obj_name, o.type_desc, m.definition
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.is_ms_shipped = 0 AND o.type IN ('P','FN','IF','TF','V','TR')
ORDER BY CASE o.type WHEN 'V' THEN 1 WHEN 'FN' THEN 2 WHEN 'IF' THEN 2 WHEN 'TF' THEN 2 WHEN 'P' THEN 3 WHEN 'TR' THEN 4 END, s.name, o.name
"@
Write-OK "modules rows = $($modules.Count)"

# ============================================================
# CREATE TABLE
# ============================================================
Write-Step "CREATE TABLE 스크립트 생성"

$tableGroups = $columns | Group-Object -Property { "$($_.schema_name)|$($_.table_name)" }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- AUTO-GENERATED: 194 -> 131 migration : tables + PK/UQ + DEFAULT (CHECK는 데이터 복사 후 별도 적용)")
[void]$sb.AppendLine("SET ANSI_NULLS ON;")
[void]$sb.AppendLine("SET QUOTED_IDENTIFIER ON;")
[void]$sb.AppendLine("GO")
[void]$sb.AppendLine()

foreach ($tg in $tableGroups) {
    $parts = $tg.Name -split '\|'
    $s = $parts[0]; $t = $parts[1]
    $cols = @($tg.Group | Sort-Object column_id)

    [void]$sb.AppendLine("-- ====== [$s].[$t] ======")
    [void]$sb.AppendLine("CREATE TABLE [$s].[$t] (")

    $lines = @()
    foreach ($c in $cols) {
        $typeStr = Format-SqlType $c.type_name $c.max_length $c.precision $c.scale
        $p = @("    [$($c.column_name)] $typeStr")
        if ($c.collation_name -and $c.type_name -in @('char','varchar','text','nchar','nvarchar','ntext')) {
            $p += "COLLATE $($c.collation_name)"
        }
        if ($c.is_identity) { $p += "IDENTITY($($c.seed_value),$($c.increment_value))" }
        $p += $(if ($c.is_nullable) { 'NULL' } else { 'NOT NULL' })
        if ($c.default_def) {
            $p += "CONSTRAINT [$($c.default_name)] DEFAULT $($c.default_def)"
        }
        $lines += ($p -join ' ')
    }

    $tPk = $pkUq | Where-Object { $_.schema_name -eq $s -and $_.table_name -eq $t -and $_.kc_type -eq 'PK' }
    if ($tPk) {
        $pkName = $tPk[0].constraint_name
        $pkClustered = if ($tPk[0].type_desc -eq 'CLUSTERED') { 'CLUSTERED' } else { 'NONCLUSTERED' }
        $pkCols = (($tPk | Sort-Object key_ordinal | ForEach-Object {
            "[$($_.column_name)]" + $(if ($_.is_descending_key) { ' DESC' } else { '' })
        }) -join ', ')
        $lines += "    CONSTRAINT [$pkName] PRIMARY KEY $pkClustered ($pkCols)"
    }

    $tUq = $pkUq | Where-Object { $_.schema_name -eq $s -and $_.table_name -eq $t -and $_.kc_type -eq 'UQ' }
    foreach ($uqName in @($tUq.constraint_name | Select-Object -Unique)) {
        $uqRows = @($tUq | Where-Object { $_.constraint_name -eq $uqName } | Sort-Object key_ordinal)
        $uqType = if ($uqRows[0].type_desc -eq 'CLUSTERED') { 'CLUSTERED' } else { 'NONCLUSTERED' }
        $uqCols = (($uqRows | ForEach-Object { "[$($_.column_name)]" + $(if ($_.is_descending_key) { ' DESC' } else { '' }) }) -join ', ')
        $lines += "    CONSTRAINT [$uqName] UNIQUE $uqType ($uqCols)"
    }

    [void]$sb.AppendLine(($lines -join ",`r`n"))
    [void]$sb.AppendLine(");")
    [void]$sb.AppendLine("GO")
    [void]$sb.AppendLine()
}
$sb.ToString() | Set-Content -Path "$outDir\01-tables.sql" -Encoding UTF8
Write-OK "wrote 01-tables.sql  (tables=$($tableGroups.Count))"

# ============================================================
# CHECK CONSTRAINTS (데이터 복사 후 적용)
# ============================================================
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- AUTO-GENERATED: CHECK constraints (데이터 복사 후 적용)")
foreach ($ck in $checks) {
    [void]$sb.AppendLine("ALTER TABLE [$($ck.schema_name)].[$($ck.table_name)] WITH CHECK ADD CONSTRAINT [$($ck.constraint_name)] CHECK $($ck.definition);")
    [void]$sb.AppendLine("ALTER TABLE [$($ck.schema_name)].[$($ck.table_name)] CHECK CONSTRAINT [$($ck.constraint_name)];")
}
[void]$sb.AppendLine("GO")
$sb.ToString() | Set-Content -Path "$outDir\02-checks.sql" -Encoding UTF8
Write-OK "wrote 02-checks.sql  (checks=$($checks.Count))"

# ============================================================
# INDEXES
# ============================================================
Write-Step "CREATE INDEX 스크립트 생성"
$indexGroups = $indexes | Group-Object -Property { "$($_.schema_name)|$($_.table_name)|$($_.index_name)" }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- AUTO-GENERATED: non-clustered indexes (PK/UQ 제외)")
foreach ($ig in $indexGroups) {
    $p = $ig.Name -split '\|'
    $s = $p[0]; $t = $p[1]; $idx = $p[2]
    $rows = @($ig.Group)
    $keyCols = @($rows | Where-Object { -not $_.is_included_column } | Sort-Object key_ordinal |
        ForEach-Object { "[$($_.column_name)]" + $(if ($_.is_descending_key) { ' DESC' } else { '' }) })
    $incCols = @($rows | Where-Object { $_.is_included_column } |
        ForEach-Object { "[$($_.column_name)]" })
    $first = $rows[0]
    $unique = if ($first.is_unique -eq 1) { 'UNIQUE ' } else { '' }
    $typeKw = if ($first.type_desc -eq 'CLUSTERED') { 'CLUSTERED' } else { 'NONCLUSTERED' }
    $stmt = "CREATE $unique$typeKw INDEX [$idx] ON [$s].[$t] ($($keyCols -join ', '))"
    if ($incCols.Count -gt 0) { $stmt += " INCLUDE ($($incCols -join ', '))" }
    if ($first.filter_definition) { $stmt += " WHERE $($first.filter_definition)" }
    [void]$sb.AppendLine("$stmt;")
}
[void]$sb.AppendLine("GO")
$sb.ToString() | Set-Content -Path "$outDir\03-indexes.sql" -Encoding UTF8
Write-OK "wrote 03-indexes.sql  (indexes=$($indexGroups.Count))"

# ============================================================
# FKs
# ============================================================
Write-Step "FOREIGN KEY 스크립트 생성"
$fkGroups = $fks | Group-Object fk_name
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- AUTO-GENERATED: FK constraints (데이터 복사 후 적용)")
foreach ($fg in $fkGroups) {
    $cols = @($fg.Group | Sort-Object constraint_column_id)
    $f = $cols[0]
    $parentCols = ($cols | ForEach-Object { "[$($_.parent_column)]" }) -join ', '
    $refCols    = ($cols | ForEach-Object { "[$($_.ref_column)]" })    -join ', '
    $onDel = if ($f.on_delete -and $f.on_delete -ne 'NO_ACTION') { " ON DELETE $($f.on_delete.Replace('_',' '))" } else { '' }
    $onUpd = if ($f.on_update -and $f.on_update -ne 'NO_ACTION') { " ON UPDATE $($f.on_update.Replace('_',' '))" } else { '' }
    [void]$sb.AppendLine(
        "ALTER TABLE [$($f.parent_schema)].[$($f.parent_table)] WITH CHECK ADD CONSTRAINT [$($fg.Name)] FOREIGN KEY ($parentCols) REFERENCES [$($f.ref_schema)].[$($f.ref_table)] ($refCols)$onDel$onUpd;"
    )
    [void]$sb.AppendLine(
        "ALTER TABLE [$($f.parent_schema)].[$($f.parent_table)] CHECK CONSTRAINT [$($fg.Name)];"
    )
}
[void]$sb.AppendLine("GO")
$sb.ToString() | Set-Content -Path "$outDir\04-fks.sql" -Encoding UTF8
Write-OK "wrote 04-fks.sql  (fks=$($fkGroups.Count))"

# ============================================================
# MODULES
# ============================================================
Write-Step "프로시저/함수/뷰/트리거 스크립트 생성"
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- AUTO-GENERATED: SP / UDF / Views / Triggers")
$skipped = 0
foreach ($m in $modules) {
    if (-not $m.definition) {
        [void]$sb.AppendLine("-- !! SKIPPED (definition null — probably WITH ENCRYPTION): [$($m.schema_name)].[$($m.obj_name)]  ($($m.type_desc))")
        $skipped++
        continue
    }
    [void]$sb.AppendLine("-- ===== [$($m.schema_name)].[$($m.obj_name)]  ($($m.type_desc)) =====")
    [void]$sb.AppendLine("GO")
    [void]$sb.AppendLine($m.definition.TrimEnd())
    [void]$sb.AppendLine("GO")
    [void]$sb.AppendLine()
}
$sb.ToString() | Set-Content -Path "$outDir\05-modules.sql" -Encoding UTF8
Write-OK "wrote 05-modules.sql  (modules=$($modules.Count), skipped=$skipped)"

Write-Step "DDL 생성 완료"
Get-ChildItem $outDir -Filter *.sql | Select-Object Name, Length | Format-Table -AutoSize
