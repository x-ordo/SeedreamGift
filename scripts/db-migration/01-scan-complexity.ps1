. "$PSScriptRoot\lib-db.ps1"

Write-Step "소스 스키마 복잡도 스캔 ($Script:SRC)"

$sql = @"
SELECT 'computed_columns' AS feature, COUNT(*) AS cnt FROM sys.computed_columns
UNION ALL SELECT 'user_defined_types', COUNT(*) FROM sys.types WHERE is_user_defined=1
UNION ALL SELECT 'sequences',         COUNT(*) FROM sys.sequences
UNION ALL SELECT 'temporal_tables',   COUNT(*) FROM sys.tables WHERE temporal_type <> 0
UNION ALL SELECT 'memory_optimized',  COUNT(*) FROM sys.tables WHERE is_memory_optimized = 1
UNION ALL SELECT 'filestream_files',  COUNT(*) FROM sys.columns WHERE is_filestream = 1
UNION ALL SELECT 'xml_schema_coll',   COUNT(*) FROM sys.xml_schema_collections WHERE schema_id NOT IN (4)
UNION ALL SELECT 'spatial_cols',      COUNT(*) FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE t.name IN ('geography','geometry')
UNION ALL SELECT 'clr_assemblies',    COUNT(*) FROM sys.assemblies WHERE is_user_defined = 1
UNION ALL SELECT 'synonyms',          COUNT(*) FROM sys.synonyms
UNION ALL SELECT 'partitioned_tbls',  (SELECT COUNT(DISTINCT i.object_id) FROM sys.indexes i WHERE i.data_space_id IN (SELECT data_space_id FROM sys.partition_schemes))
UNION ALL SELECT 'fulltext_indexes',  (SELECT COUNT(*) FROM sys.fulltext_indexes)
UNION ALL SELECT 'user_schemas',      (SELECT COUNT(*) FROM sys.schemas WHERE schema_id > 4 AND principal_id = 1) -- non-system dbo etc
"@
Invoke-Query $Script:SRC $Script:DB $sql | Format-Table -AutoSize

Write-Step "객체 유형별 개수"
Invoke-Query $Script:SRC $Script:DB @"
SELECT type_desc, COUNT(*) AS cnt
FROM sys.objects
WHERE is_ms_shipped = 0
GROUP BY type_desc
ORDER BY cnt DESC
"@ | Format-Table -AutoSize

Write-Step "스키마 목록 (비시스템)"
Invoke-Query $Script:SRC $Script:DB @"
SELECT s.name, USER_NAME(s.principal_id) AS owner
FROM sys.schemas s
WHERE s.schema_id > 4 AND s.schema_id < 16384
ORDER BY s.name
"@ | Format-Table -AutoSize

Write-Step "사용되는 데이터 타입 (user_tables만)"
Invoke-Query $Script:SRC $Script:DB @"
SELECT DISTINCT
  CASE WHEN t.is_user_defined = 1 THEN 'UDT:' + t.name ELSE t.name END AS type_name,
  COUNT(*) OVER (PARTITION BY t.name) AS usage_cnt
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
JOIN sys.tables tb ON c.object_id = tb.object_id
WHERE tb.is_ms_shipped = 0
ORDER BY usage_cnt DESC, type_name
"@ | Format-Table -AutoSize

Write-Step "컬럼 기본값/CHECK 제약 샘플"
Invoke-Query $Script:SRC $Script:DB @"
SELECT 'DEFAULT' AS kind, COUNT(*) AS cnt FROM sys.default_constraints
UNION ALL SELECT 'CHECK', COUNT(*) FROM sys.check_constraints
UNION ALL SELECT 'FK', COUNT(*) FROM sys.foreign_keys
UNION ALL SELECT 'UQ', COUNT(*) FROM sys.key_constraints WHERE type = 'UQ'
UNION ALL SELECT 'PK', COUNT(*) FROM sys.key_constraints WHERE type = 'PK'
UNION ALL SELECT 'IDX_NONCLUSTERED', COUNT(*) FROM sys.indexes WHERE index_id > 1 AND is_primary_key = 0 AND is_unique_constraint = 0 AND type_desc = 'NONCLUSTERED'
"@ | Format-Table -AutoSize
