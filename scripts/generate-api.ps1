# scripts/generate-api.ps1
# Windows Asset-Builder: One-Shot API Generation Script

Write-Host "========== [1/2] Generating Swagger JSON from Backend ==========" -ForegroundColor Cyan
cd server
# Use compiled script if possible, or fallback
if (Test-Path "scripts/dist/scripts/generate-swagger-json.js") {
    node scripts/dist/scripts/generate-swagger-json.js
} else {
    # Fallback to ts-node if build missing
    npx ts-node -r tsconfig-paths/register scripts/generate-swagger-json.ts
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate Swagger JSON."
    exit 1
}
cd ..

Write-Host "========== [2/2] Generating Frontend API Client ==========" -ForegroundColor Cyan
$SwaggerPath = "$PSScriptRoot\..\server\swagger-spec.json"
$OutputPath = "$PSScriptRoot\..\client\src\api\generated"

# Clean old generation
if (Test-Path $OutputPath) {
    Remove-Item -Path $OutputPath -Recurse -Force
}

# Generate Client (typescript-axios)
npx @openapitools/openapi-generator-cli generate `
    -i $SwaggerPath `
    -g typescript-axios `
    -o $OutputPath `
    --additional-properties=useSingleRequestParameter=true `
    --additional-properties=supportsES6=true `
    --additional-properties=withSeparateModelsAndApi=true `
    --additional-properties=apiPackage=api `
    --additional-properties=modelPackage=models

Write-Host "========== API Client Generation Complete ==========" -ForegroundColor Green
Write-Host "Location: client/src/api/generated"
