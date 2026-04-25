# mePass 使用文档

mePass 是一款本地 CLI 敏感信息管理工具，用于安全存储和快速查询账号密码、邮箱密码、API Key 和加密笔记。

## 快速开始

### 安装

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/so-you/mepass/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/so-you/mepass/main/install.ps1 | iex
```

前置要求：Node.js 20+

### 初始化

```bash
mepass init
```

首次使用需要设置主密码。初始化完成后，同一设备上日常操作无需再次输入密码。

## 信息类型

| 类型 | 编码 | 用途 | 必填字段 |
|------|------|------|----------|
| account | 账号 | 平台账号密码 | name, username, password |
| email | 邮箱 | 邮箱账号密码 | name, username, password |
| api_key | API Key | 第三方服务密钥 | name, baseurl, apikey |
| note | 笔记 | 加密短文本 | name, note |

## 命令参考

### mepass init

初始化 mePass，创建本地数据库和加密密钥。

```bash
mepass init
```

交互式输入：
- 主密码（需输入两次确认，最少 6 位）

输出内容：
- 数据目录路径
- 数据库文件路径
- 配置文件路径
- 密钥来源（系统钥匙串 / 本地密钥文件）

重复执行不会覆盖已有数据。

---

### mepass add

新增一条记录。

```bash
mepass add --type <类型>
mepass add -a    # 快捷添加账号
mepass add -e    # 快捷添加邮箱
mepass add -k    # 快捷添加 API Key
mepass add -n    # 快捷添加笔记
```

| 参数 | 说明 |
|------|------|
| `-t, --type <类型>` | 记录类型：account / email / api_key / note |
| `-a` | 等同 `--type account` |
| `-e` | 等同 `--type email` |
| `-k` | 等同 `--type api_key` |
| `-n` | 等同 `--type note` |

交互式输入（根据类型不同）：

**account / email：**
| 字段 | 必填 | 说明 |
|------|------|------|
| 名称 | 是 | 平台或服务名称 |
| 用户名 | 是 | 登录用户名或邮箱地址 |
| 密码 | 是 | 登录密码（隐藏输入） |
| 网址 | 否 | 平台登录页地址 |
| 备注 | 否 | 非敏感备注 |
| 标签 | 否 | 逗号分隔，如 `work, dev` |

**api_key：**
| 字段 | 必填 | 说明 |
|------|------|------|
| 名称 | 是 | 服务名称 |
| Base URL | 是 | API 基础地址 |
| API Key | 是 | 密钥内容（隐藏输入） |
| 备注 | 否 | 非敏感备注 |
| 标签 | 否 | 逗号分隔 |

**note：**
| 字段 | 必填 | 说明 |
|------|------|------|
| 名称 | 是 | 记录名称 |
| 笔记内容 | 是 | 加密存储的文本 |
| 备注 | 否 | 非敏感备注 |
| 标签 | 否 | 逗号分隔 |

添加成功后返回 short_id（6 位数字）。

示例：

```bash
mepass add -k
# 交互式输入 OpenAI API Key 信息

mepass add --type account
# 交互式输入 GitHub 账号信息
```

---

### mepass list

列出记录，支持多条件筛选。默认不展示敏感字段。

```bash
mepass list                          # 列出所有记录
mepass list --type email             # 按类型筛选
mepass list --tag ai                 # 按标签筛选
mepass list --query gmail            # 模糊搜索
mepass list --tag ai --json          # JSON 格式输出
```

| 参数 | 说明 |
|------|------|
| `-t, --type <类型>` | 按类型筛选：account / email / api_key / note |
| `--tag <标签>` | 按标签筛选（包含匹配） |
| `-q, --query <关键字>` | 模糊搜索 name、username、baseurl、url、remark、tags |
| `--limit <数量>` | 每页数量，默认 50 |
| `--offset <偏移>` | 分页偏移，默认 0 |
| `--json` | JSON 格式输出 |

默认输出表格，包含：Short ID、类型、名称、用户名、Base URL、URL、标签、更新时间。

---

### mepass get

查询单条记录。支持 short_id 精确查询和关键字模糊查询。

```bash
mepass get 297198                    # 按 short_id 查询
mepass get openai                    # 模糊搜索
mepass get gmail --type email        # 按类型限定搜索
mepass get 297198 --reveal           # 显示敏感字段明文
mepass get 297198 --copy apikey      # 复制字段到剪贴板
mepass get openai --json             # JSON 格式输出
```

| 参数 | 说明 |
|------|------|
| `<query>` | 查询关键字或 short_id（必填） |
| `-t, --type <类型>` | 限定搜索类型 |
| `--reveal` | 显示敏感字段明文（密码、API Key、笔记） |
| `--copy <字段>` | 复制指定字段到剪贴板：password / apikey / note |
| `--json` | JSON 格式输出 |

行为说明：
- 输入 6 位数字时按 short_id 精确查询
- 输入其他内容时对 name、username、baseurl、url、remark、tags 模糊匹配
- 多条匹配时进入选择列表
- 默认敏感字段显示为 `••••••`
- `--copy` 复制后 60 秒自动清除剪贴板，终端不打印明文

各类型可复制字段：

| 类型 | 可复制字段 |
|------|-----------|
| account | password |
| email | password |
| api_key | apikey |
| note | note |

---

### mepass edit

交互式编辑已有记录。

```bash
mepass edit --id 297198
```

| 参数 | 说明 |
|------|------|
| `--id <short_id>` | 要编辑的记录 short_id（必填） |

交互式编辑：
- 显示当前字段值
- 直接回车保留原值
- 输入新值则更新
- 修改密码/API Key/笔记时自动重新加密
- 修改标签时自动规范化（去重、排序、加类型标签）

---

### mepass delete

删除一条记录。需二次确认。

```bash
mepass delete --id 297198
```

| 参数 | 说明 |
|------|------|
| `--id <short_id>` | 要删除的记录 short_id（必填） |

执行流程：
1. 显示记录摘要（非敏感字段）
2. 要求输入 `yes` 确认
3. 输入其他内容则取消操作

---

### mepass status

显示当前安装和数据库状态。

```bash
mepass status
```

输出内容：
- 数据目录路径
- 数据库文件路径
- 配置文件路径
- 密钥来源（系统钥匙串 / 本地密钥文件）
- 总记录数
- 各类型记录数

---

## 标签规则

- 多个标签用英文逗号分隔：`ai, openai, work`
- 输入时可带或不带 `#`，系统统一移除
- 标签自动转小写、去空格、去重、按字母排序
- 创建记录时自动添加类型标签（account / email / api_key / note）

示例：

```
输入：#AI, openai, ai
保存：ai,api_key,openai
```

## Short ID 规则

Short ID 是 6 位数字，格式为 `[类型码][4位随机数][校验位]`。

| 类型 | 类型码 |
|------|--------|
| account | 0 |
| email | 1 |
| api_key | 2 |
| note | 3 |

## 数据迁移

`mepass.db` 文件可在 macOS、Linux、Windows 之间互相迁移：

1. 复制 `mepass.db` 到新设备
2. 安装 mePass
3. 执行任意需要解密的命令时，输入主密码解锁
4. 解锁成功后自动绑定新设备，后续无需再次输入

数据目录位置：

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/mePass/` |
| Linux | `~/.local/share/mepass/` |
| Windows | `%APPDATA%/mePass/` |

## 安全说明

- password、apikey、note 使用 AES-256-GCM 加密存储
- 加密密钥通过 scrypt KDF 从主密码派生（信封加密）
- macOS 使用 Keychain 保存密钥，Linux 使用 Secret Service，Windows 使用 Credential Manager
- 系统钥匙串不可用时自动降级为本地 `vault.key` 文件（权限 0600）
- 列表命令永不展示敏感字段明文
- `--copy` 不在终端打印明文，60 秒后自动清除剪贴板
