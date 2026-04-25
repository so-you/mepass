#!/usr/bin/env bash
set -euo pipefail

REPO="so-you/mepass"
INSTALL_DIR="${HOME}/.mepass"
BIN_DIR="${HOME}/.local/bin"

echo "mePass 安装程序"
echo "================"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux) PLATFORM="linux" ;;
  *)
    echo "不支持的操作系统: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "不支持的架构: $ARCH"
    exit 1
    ;;
esac

ARTIFACT="mepass-${PLATFORM}-${ARCH}.tar.gz"

# Get latest release tag
echo "正在获取最新版本..."
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "无法获取最新版本"
  exit 1
fi

echo "最新版本: ${LATEST}"

# Download
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${ARTIFACT}"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "正在下载 ${ARTIFACT}..."
curl -fsSL -o "${TMPDIR}/${ARTIFACT}" "${DOWNLOAD_URL}"

# Install
echo "正在安装到 ${INSTALL_DIR}..."
rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

tar -xzf "${TMPDIR}/${ARTIFACT}" -C "${INSTALL_DIR}" --strip-components=1

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

if [ -d "${HOME}/.zshrc" ] 2>/dev/null || [ -f "${HOME}/.zshrc" ]; then
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
