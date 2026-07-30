$scriptsDir = python -c "import sysconfig; print(sysconfig.get_path('scripts'))"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -split ";" -contains $scriptsDir) {
    Write-Host "  Already on PATH: $scriptsDir" -ForegroundColor Green
} else {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$scriptsDir", "User")
    Write-Host "  Added to PATH: $scriptsDir" -ForegroundColor Green
    Write-Host "  Restart your terminal or run:  `$env:Path = [Environment]::GetEnvironmentVariable('Path','User')" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Now you can run 'notes-ai' from anywhere!" -ForegroundColor Cyan
Write-Host "  Try:  notes-ai --help" -ForegroundColor Cyan
