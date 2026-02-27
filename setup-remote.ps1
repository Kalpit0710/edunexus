# =============================================================================
# EduNexus — Remote Supabase Setup Script
# =============================================================================
# BEFORE RUNNING: Add your Supabase access token to .env.local
#   SUPABASE_ACCESS_TOKEN=your_token_here
#
# Get your token at: https://supabase.com/dashboard/account/tokens
# =============================================================================

$ErrorActionPreference = "Stop"

# Load .env.local
$envFile = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found. Copy .env.example to .env.local and fill in values."
    exit 1
}

# Parse .env.local
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token -or $token -eq "your-personal-access-token-here") {
    Write-Host ""
    Write-Host "ERROR: SUPABASE_ACCESS_TOKEN is not set in .env.local" -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps to get your token:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://supabase.com/dashboard/account/tokens"
    Write-Host "  2. Click 'Generate new token'"
    Write-Host "  3. Name it 'edunexus-cli' and copy it"
    Write-Host "  4. Open .env.local and set: SUPABASE_ACCESS_TOKEN=<your_token>"
    Write-Host "  5. Re-run this script"
    Write-Host ""
    exit 1
}

$supabase = "C:\Users\ASUS\supabase_bin\supabase.exe"
$projectRef = "dgmqcrhogtbkzkprzjor"

Write-Host ""
Write-Host "=== EduNexus Remote Supabase Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Link project
Write-Host "[1/3] Linking to Supabase project $projectRef..." -ForegroundColor Yellow
& $supabase link --project-ref $projectRef --password "" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Link failed or already linked — continuing..." -ForegroundColor DarkYellow
}

# Step 2: Push migrations
Write-Host ""
Write-Host "[2/3] Pushing database migrations..." -ForegroundColor Yellow
& $supabase db push --yes 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Migration push failed. Check the error above." -ForegroundColor Red
    Write-Host "Alternatively, run migrations manually via SQL Editor:"
    Write-Host "  https://supabase.com/dashboard/project/$projectRef/sql/new"
    exit 1
}

# Step 3: Generate TypeScript types
Write-Host ""
Write-Host "[3/3] Generating TypeScript types from live schema..." -ForegroundColor Yellow
& $supabase gen types typescript --project-id $projectRef --schema public `
    | Out-File -FilePath "src\types\database.types.ts" -Encoding utf8

if ($LASTEXITCODE -ne 0) {
    Write-Host "Type generation failed. You can run it manually: pnpm db:types" -ForegroundColor DarkYellow
} else {
    Write-Host ""
    Write-Host "database.types.ts updated from live schema." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  pnpm dev     — start development server at http://localhost:3000"
Write-Host ""
