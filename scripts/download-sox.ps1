# Enable TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$soxVersion = "14.4.2"
$downloadUrl = "https://github.com/JoFrhwld/FAVE/raw/master/sox-14.4.2-win32.zip"
$outputPath = Join-Path $PSScriptRoot "..\sox-$soxVersion.zip"
$extractPath = Join-Path $PSScriptRoot ".."

Write-Host "Downloading Sox..."
$webClient = New-Object System.Net.WebClient
$webClient.DownloadFile($downloadUrl, $outputPath)

Write-Host "Extracting Sox..."
Expand-Archive -Path $outputPath -DestinationPath $extractPath -Force

Write-Host "Cleaning up..."
Remove-Item $outputPath

$soxExePath = Join-Path $extractPath "sox-$soxVersion\sox.exe"
if (Test-Path $soxExePath) {
    Write-Host "Sox installed successfully!"
    Write-Host "Location: $soxExePath"
    
    # Add Sox directory to PATH
    $soxDir = Split-Path $soxExePath
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (-not $currentPath.Contains($soxDir)) {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$soxDir", "User")
        Write-Host "Added Sox directory to PATH"
    }
    
    # Set SOX_PATH with the correct path format
    [Environment]::SetEnvironmentVariable("SOX_PATH", $soxExePath, "User")
    Write-Host "Set SOX_PATH environment variable"
    
    # Verify installation
    Write-Host "Verifying installation..."
    $soxVersion = & $soxExePath --version
    Write-Host "Sox version: $soxVersion"
    
    # Verify environment variables
    Write-Host "`nVerifying environment variables:"
    Write-Host "SOX_PATH: $([Environment]::GetEnvironmentVariable('SOX_PATH', 'User'))"
    Write-Host "PATH: $([Environment]::GetEnvironmentVariable('Path', 'User'))"
} else {
    Write-Host "Sox installation failed. sox.exe not found."
    exit 1
} 