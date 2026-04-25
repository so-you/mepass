# mePass

mePass 是一款面向个人开发者和命令行用户的本地密码与敏感信息管理 CLI 工具。它用于管理账号密码、邮箱密码、API Key 和加密笔记，数据保存在本机 SQLite 数据库中，`password`、`apikey`、`note` 使用 AES-256-GCM 加密存储。

mePass 支持 macOS、Linux、Windows。

## 特性

- 本地优先：不依赖云端账户，不内置云同步。
- 跨平台：macOS、Linux、Windows 使用一致的 CLI 体验。
- 可迁移：初始化时设置用户主密码，迁移数据库到新设备后可通过主密码恢复访问。
- 免重复输入：本机完成密钥绑定后，日常新增、查询、复制、删除无需反复输入主密码。
- 明文检索：`username`、`baseurl`、`url`、`remark`、`tags` 支持模糊查询。
- 加密存储：`password`、`apikey`、`note` 加密存储。
- 标签管理：标签使用英文逗号分隔，例如 `ai,openai,work`。

## 安装

### 前置要求

- Node.js 20+
- Git
- curl（macOS/Linux）
- PowerShell（Windows）

### macOS / Linux

```shell
curl -fsSL https://raw.githubusercontent.com/so-you/mepass/main/install.sh | bash
```

安装脚本会：

1. 检查 Node.js 版本。
2. 下载 mePass 源码到 `~/.mepass`。
3. 安装生产依赖并编译 TypeScript。
4. 创建命令入口 `~/.local/bin/mepass`。
5. 在可识别的 shell 配置中追加 `~/.local/bin` 到 `PATH`。

安装后如果当前终端无法直接运行 `mepass`，执行：

```shell
export PATH="$HOME/.local/bin:$PATH"
```

### Windows

在 PowerShell 中执行：

```powershell
irm https://raw.githubusercontent.com/so-you/mepass/main/install.ps1 | iex
```

安装脚本会：

1. 检查 Node.js 和 Git。
2. 下载 mePass 源码到 `%APPDATA%\mePass\app`。
3. 安装生产依赖并编译 TypeScript。
4. 创建命令入口 `%APPDATA%\mePass\bin\mepass.cmd`。
5. 将 `%APPDATA%\mePass\bin` 写入用户级 `PATH`。

安装完成后请重新打开终端，再运行：

```powershell
mepass init
```

### 从源码运行

```shell
git clone git@github.com:so-you/mepass.git
cd mepass
npm install
npm run build
node dist/cli.js --help
```

## 快速开始

### 1. 初始化

```shell
mepass init
```

初始化时需要设置一次主密码。主密码用于迁移和恢复，不会直接保存明文。

初始化完成后，mePass 会生成随机数据密钥，并将数据密钥绑定到当前设备。之后在同一台设备上执行日常命令时，不需要反复输入主密码。

### 2. 新增记录

新增账号密码：

```shell
mepass add --type account
```

新增邮箱密码：

```shell
mepass add --type email
```

新增 API Key：

```shell
mepass add --type api_key
```

新增加密笔记：

```shell
mepass add --type note
```

也可以使用快捷参数：

```shell
mepass add -a   # account
mepass add -e   # email
mepass add -k   # api_key
mepass add -n   # note
```

### 3. 列出记录

```shell
mepass list
```

按类型筛选：

```shell
mepass list --type email
```

按标签筛选：

```shell
mepass list --tag ai
```

按关键字模糊查询：

```shell
mepass list --query gmail
```

JSON 输出：

```shell
mepass list --json
```

### 4. 查询记录

按关键字查询：

```shell
mepass get openai
```

按 short_id 查询：

```shell
mepass get 112783
```

显示敏感字段明文：

```shell
mepass get 112783 --reveal
```

复制敏感字段到剪贴板：

```shell
mepass get openai --copy apikey
mepass get github --copy password
mepass get recovery --copy note
```

### 5. 编辑记录

```shell
mepass edit --id 112783
```

### 6. 删除记录

```shell
mepass delete --id 112783
```

删除前需要输入 `yes` 确认。

### 7. 查看状态

```shell
mepass status
```

状态命令会显示数据目录、数据库路径、配置路径、密钥来源和记录数量。

## 命令参考

```text
mepass init
mepass add --type <account|email|api_key|note>
mepass add -a|-e|-k|-n
mepass list [--type type] [--tag tag] [--query keyword] [--limit n] [--offset n] [--json]
mepass get <keyword|short_id> [--type type] [--reveal] [--copy password|apikey|note] [--json]
mepass edit --id short_id
mepass delete --id short_id
mepass status
```

## 数据模型

| 类型 | 必填字段 | 加密字段 |
| --- | --- | --- |
| `account` | `name`, `username`, `password` | `password` |
| `email` | `name`, `username`, `password` | `password` |
| `api_key` | `name`, `baseurl`, `apikey` | `apikey` |
| `note` | `name`, `note` | `note` |

明文检索字段：

- `name`
- `username`
- `baseurl`
- `url`
- `remark`
- `tags`

## 数据位置

| 系统 | 默认数据目录 |
| --- | --- |
| macOS | `~/Library/Application Support/mePass/` |
| Linux | `~/.local/share/mepass/` |
| Windows | `%APPDATA%\mePass\` |

主要文件：

- `mepass.db`：SQLite 数据库。
- `config.json`：非敏感配置。
- `vault.key`：系统钥匙串不可用时的本机密钥兜底文件。

## 安全说明

- 用户主密码用于迁移和恢复。
- 数据密钥用于加密 `password`、`apikey`、`note`。
- 数据库中保存的是加密后的数据密钥，迁移到新设备后可通过主密码解锁。
- 本机日常免输入依赖系统钥匙串或 `vault.key`。
- mePass 不上传数据，不提供云同步；用户可自行备份或同步 `mepass.db`。

## 开发

安装依赖：

```shell
npm install
```

构建：

```shell
npm run build
```

测试：

```shell
npm test
```

开发模式：

```shell
npm run dev
```

## 文档

- [产品设计说明书](docs/product-design.md)
- [技术方案文档](docs/technical-solution.md)
- [测试报告](docs/test-report.md)

## License

ISC

