#!/usr/bin/env bash
set -euo pipefail

REPO="so-you/mepass"
INSTALL_DIR="${HOME}/.mepass"
BIN_DIR="${HOME}/.local/bin"

echo "mePass 安装程序"
echo "================"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "错误：未检测到 Node.js，请先安装 Node.js 20+"
  echo "  https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "错误：Node.js 版本过低（当前 $(node -v)），需要 20+"
  exit 1
fi

echo "Node.js: $(node -v) ✓"

# Get latest version
echo "正在获取最新版本..."
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || echo "")

if [ -z "$LATEST" ]; then
  LATEST="main"
  echo "使用 main 分支"
else
  echo "最新版本: ${LATEST}"
fi

# Clone and build
echo "正在下载源码..."
rm -rf "${INSTALL_DIR}"
git clone --depth 1 --branch "${LATEST}" "https://github.com/${REPO}.git" "${INSTALL_DIR}" 2>/dev/null

echo "正在安装依赖..."
cd "${INSTALL_DIR}"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "正在编译..."
npx tsc

# Create bin wrapper
mkdir -p "${BIN_DIR}"
cat > "${BIN_DIR}/mepass" << WRAPPER
#!/usr/bin/env bash
exec node "${INSTALL_DIR}/dist/cli.js" "\$@"
WRAPPER
chmod +x "${BIN_DIR}/mepass"

# Add to PATH if needed
add_to_path() {
  local rc_file="${HOME}/$1"
  local export_line='export PATH="${HOME}/.local/bin:${PATH}"'

  if [ -f "$rc_file" ] && ! grep -qF '.local/bin' "$rc_file" 2>/dev/null; then
    echo "" >> "$rc_file"
    echo "$export_line" >> "$rc_file"
    echo "已添加 PATH 到 ${rc_file}"
  fi
}

if [ -f "${HOME}/.zshrc" ]; then
  add_to_path ".zshrc"
fi
if [ -f "${HOME}/.bashrc" ]; then
  add_to_path ".bashrc"
fi
if [ -f "${HOME}/.bash_profile" ]; then
  add_to_path ".bash_profile"
fi

echo ""
echo "安装完成！"
echo "  安装目录: ${INSTALL_DIR}"
echo "  命令路径: ${BIN_DIR}/mepass"
echo ""
echo "请执行以下命令刷新 PATH，或重新打开终端："
echo "  export PATH=\"${HOME}/.local/bin:\${PATH}\""
echo ""
echo "然后运行："
echo "  mepass init"
