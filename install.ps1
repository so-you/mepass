# mePass Windows Installer
# Run: irm https://raw.githubusercontent.com/so-you/mepass/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "so-you/mepass"
$InstallDir = "$env:APPDATA\mePass\app"
$BinDir = "$env:APPDATA\mePass\bin"

Write-Host "mePass 安装程序" -ForegroundColor Cyan
Write-Host "================"

# Check Node.js
$nodeExe = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExe) {
    Write-Host "错误：未检测到 Node.js，请先安装 Node.js 20+" -ForegroundColor Red
    Write-Host "  https://nodejs.org/"
    exit 1
}

$nodeVersion = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 20) {
    Write-Host "错误：Node.js 版本过低（当前 $(node -v)），需要 20+" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js: $(node -v) ✓"

# Check git
$gitExe = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitExe) {
    Write-Host "错误：未检测到 git，请先安装 git" -ForegroundColor Red
    exit 1
}

# Get latest version
Write-Host "正在获取最新版本..."
try {
    $Latest = (Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest").tag_name
    Write-Host "最新版本: $Latest"
} catch {
    $Latest = "main"
    Write-Host "使用 main 分支"
}

# Clone and build
Write-Host "正在下载源码..."
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
git clone --depth 1 --branch $Latest "https://github.com/$Repo.git" $InstallDir

Write-Host "正在安装依赖..."
Push-Location $InstallDir
npm ci --omit=dev 2>$null
if ($LASTEXITCODE -ne 0) { npm install --omit=dev }

Write-Host "正在编译..."
npx tsc
Pop-Location

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

Write-Host ""
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "  安装目录: $InstallDir"
Write-Host "  命令路径: $BinDir\mepass.cmd"
Write-Host ""
Write-Host "请重新打开终端，然后运行："
Write-Host "  mepass init"
