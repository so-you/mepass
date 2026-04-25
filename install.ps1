# mePass Windows Installer
# Run: irm https://raw.githubusercontent.com/so-you/mepass/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "so-you/mepass"
$InstallDir = "$env:APPDATA\mePass\app"
$BinDir = "$env:APPDATA\mePass\bin"

Write-Host "mePass 安装程序" -ForegroundColor Cyan
Write-Host "================"

# Get latest release
Write-Host "正在获取最新版本..."
$Latest = (Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest").tag_name
if (-not $Latest) {
    Write-Host "无法获取最新版本" -ForegroundColor Red
    exit 1
}
Write-Host "最新版本: $Latest"

# Download
$Artifact = "mepass-windows-x64.zip"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Latest/$Artifact"
$TempFile = "$env:TEMP\$Artifact"
$TempDir = "$env:TEMP\mepass-install"

Write-Host "正在下载 $Artifact..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile

# Install
Write-Host "正在安装到 $InstallDir..."
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Expand-Archive -Path $TempFile -DestinationPath $TempDir -Force
Copy-Item -Recurse "$TempDir\mepass\*" $InstallDir

# Create launcher
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$LauncherContent = "@echo off`r`nnode `"%APPDATA%\mePass\app\dist\cli.js`" %*"
Set-Content -Path "$BinDir\mepass.cmd" -Value $LauncherContent

# Add to PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$BinDir", "User")
    Write-Host "已添加到用户 PATH"
}

# Cleanup
Remove-Item -Force $TempFile
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "  安装目录: $InstallDir"
Write-Host "  命令路径: $BinDir\mepass.cmd"
Write-Host ""
Write-Host "请重新打开终端，然后运行："
Write-Host "  mepass init"
