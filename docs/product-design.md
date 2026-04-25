# mePass 产品设计说明书

## 1. 产品概述

mePass 是一款面向个人开发者和命令行用户的本地敏感信息管理工具。产品通过 CLI 管理账号密码、邮箱密码、API Key 和加密笔记，数据保存在本机 SQLite 数据库中。

mePass 是个人使用的工具类软件，核心目标是“本地可控、命令行高效、可迁移、日常操作无需反复输入密码”。产品支持 macOS、Linux、Windows。产品不设计云端账户、云同步、团队共享和浏览器插件能力。数据库文件由用户自行备份或通过任意第三方方式同步。

## 2. 产品定位

### 2.1 目标用户

- 经常使用终端的个人开发者、独立开发者、运维和技术用户。
- 需要保存 API Key、账号密码、邮箱密码、测试账号、恢复码和短笔记的用户。
- 希望用一条命令快速查询、复制、维护本地敏感信息的用户。

### 2.2 核心价值

- 本地存储：所有业务数据写入本机 SQLite 数据库。
- 免密码操作：初始化时设置用户主密码，本机完成钥匙串绑定后执行新增、查询、复制、删除等命令不要求反复输入主密码。
- 命令行友好：命令短、交互少，适合开发工作流。
- 快速检索：支持按名称、username、baseurl、url、备注、类型和标签模糊查询。
- 敏感字段加密：password、apikey、note 正文加密存储。
- 跨平台可用：macOS、Linux、Windows 使用一致的命令和数据结构。

### 2.3 产品边界

- 不实现云端账户。
- 不实现云同步。
- 不实现团队共享。
- 不实现浏览器自动填充。
- 不实现企业级密钥管理和权限审计。
- 不内置同步协议；用户可自行同步 `mepass.db` 文件。

### 2.4 支持平台

| 平台 | 支持状态 | 密钥绑定方式 | 默认数据目录 |
| --- | --- | --- | --- |
| macOS | 必须支持 | Keychain | `~/Library/Application Support/mePass/` |
| Linux | 必须支持 | Secret Service/libsecret | `~/.local/share/mepass/` |
| Windows | 必须支持 | Credential Manager | `%APPDATA%/mePass/` |

跨平台要求：

- 三个平台使用相同的 CLI 命令、字段定义、SQLite schema 和加密格式。
- 三个平台生成的 `mepass.db` 可互相迁移。
- 迁移到新设备或新系统后，用户输入主密码即可重新绑定当前设备。
- 系统钥匙串不可用时，三个平台都必须支持 `vault.key` 兜底。

## 3. 使用场景

### 3.1 保存账号密码

用户保存 GitHub、微博、服务器面板等账号密码。mePass 记录平台名称、username、password、url、备注和标签。username 明文存储并支持模糊查询，password 加密存储。

### 3.2 保存邮箱密码

用户保存邮箱账号、邮箱密码、网页登录地址和服务商标签。邮箱地址作为 username 明文存储，支持通过邮箱片段快速查找。

### 3.3 保存 API Key

用户保存 OpenAI、DashScope、GitHub Token 等 API Key。API Key 类型包含 name、baseurl、apikey、remark 和 tags。baseurl 明文存储并支持模糊查询，apikey 加密存储并支持复制。

### 3.4 保存加密笔记

用户保存恢复码、短说明、临时凭据说明等短文本。note 正文加密存储，name、remark、tags 用于检索。

### 3.5 快速查询和复制

用户通过关键字找到记录，并把 password、apikey 或 note 复制到剪贴板。默认查询结果不展示敏感字段明文，只有显式 `--reveal` 时输出明文。

## 4. 信息架构

### 4.1 信息类型

| 类型 | 编码 | 说明 | 必填字段 |
| --- | --- | --- | --- |
| 账号 | account | 普通平台账号密码 | name, username, password |
| 邮箱 | email | 邮箱账号密码 | name, username, password |
| API Key | api_key | 第三方服务 API Key | name, baseurl, apikey |
| 笔记 | note | 加密短文本笔记 | name, note |

### 4.2 字段定义

| 字段 | 说明 | 是否加密 | 适用类型 | 是否必填 |
| --- | --- | --- | --- | --- |
| id | 数据库内部主键 | 否 | 全部 | 是 |
| short_id | 用户可见 6 位短 ID | 否 | 全部 | 是 |
| type | 信息类型 | 否 | 全部 | 是 |
| name | 平台、服务或记录名称 | 否 | 全部 | 是 |
| username | 账号名、邮箱地址或登录名 | 否 | account/email | account/email 必填 |
| password | 账号或邮箱密码 | 是 | account/email | account/email 必填 |
| baseurl | API 服务基础地址 | 否 | api_key | api_key 必填 |
| apikey | API Key、Token、Secret | 是 | api_key | api_key 必填 |
| url | 平台网页登录地址 | 否 | account/email | 否 |
| note | 加密笔记正文 | 是 | note | note 必填 |
| remark | 非敏感备注 | 否 | 全部 | 否 |
| tags | 逗号分隔的标签字符串 | 否 | 全部 | 否 |
| created_at | 创建时间 | 否 | 全部 | 是 |
| updated_at | 更新时间 | 否 | 全部 | 是 |
| last_accessed_at | 最近访问时间 | 否 | 全部 | 否 |

### 4.3 标签规则

- 标签以单字段字符串保存，多个标签使用英文逗号分割。
- 示例：`ai,openai,work`。
- 用户输入标签时可带或不带 `#`，系统统一移除 `#` 后保存。
- 标签保存前执行 trim、小写化、去空值、去重。
- 每条记录创建时自动加入类型标签：`account`、`email`、`api_key`、`note`。
- 标签筛选使用包含匹配，查询 `ai` 时可匹配 tags 中的 `ai`。

## 5. 核心功能

### 5.1 初始化

命令：

```shell
mepass init
```

功能：

- 创建本地数据目录。
- 创建 `mepass.db`。
- 创建数据库表和索引。
- 要求用户设置并确认主密码。
- 自动生成随机数据密钥。
- 使用主密码派生密钥，加密数据密钥并保存到数据库元信息中。
- 将明文数据密钥绑定到当前设备：优先保存到系统钥匙串；系统钥匙串不可用时保存到 `vault.key`，文件权限设置为 `0600`。

验收标准：

- 首次执行完成后，本机可直接使用 `add/list/get/delete`。
- 重复执行不会覆盖已有数据库和密钥。
- 初始化结果中明确输出数据库文件路径。
- 迁移数据库到新设备后，可通过主密码完成解锁并重新绑定新设备。

### 5.2 新增记录

命令：

```shell
mepass add --type account
mepass add --type email
mepass add --type api_key
mepass add --type note
```

快捷别名：

```shell
mepass add -a
mepass add -e
mepass add -k
mepass add -n
```

功能：

- 根据类型进入交互式表单。
- password、apikey、note 使用隐藏或多行输入。
- 写入前校验必填字段。
- 自动规范化标签并加入类型标签。
- 加密 password、apikey、note 后写入数据库。
- 新增成功后返回 short_id。

验收标准：

- account/email 必须填写 username 和 password。
- api_key 必须填写 baseurl 和 apikey。
- note 必须填写 note 正文。
- 敏感字段不会出现在 shell history。

### 5.3 列表与筛选

命令：

```shell
mepass list
mepass list --type email
mepass list --tag ai
mepass list --query gmail
```

功能：

- 展示 short_id、type、name、username、baseurl、url、tags、updated_at。
- 不展示 password、apikey、note 明文。
- 支持按 type、tag、query 组合筛选。
- query 对 name、username、baseurl、url、remark、tags 做模糊匹配。

验收标准：

- 列表命令不触发密码输入。
- 列表命令不解密敏感字段。
- 结果按 updated_at 倒序排列。

### 5.4 查询记录

命令：

```shell
mepass get gmail
mepass get aa --type email
mepass get openai --type api_key
mepass get 112783
```

功能：

- 支持 short_id 精确查询。
- 支持 name、username、baseurl、url、remark、tags 模糊查询。
- 多条匹配时进入选择列表。
- 默认展示非敏感字段和敏感字段占位符。
- 指定 `--reveal` 时输出敏感字段明文。
- 指定 `--copy password`、`--copy apikey` 或 `--copy note` 时复制对应字段到剪贴板。

验收标准：

- 查询命令不要求用户输入密码。
- 未指定 `--reveal` 时不输出敏感明文。
- `--copy` 成功后提示已复制，不在终端打印明文。

### 5.5 修改记录

命令：

```shell
mepass edit --id 112783
```

功能：

- 根据 short_id 定位记录。
- 进入交互式编辑。
- 未输入的新值保持原字段不变。
- 修改 password、apikey、note 时重新加密。
- 修改 tags 时重新执行标签规范化。

验收标准：

- 修改后 updated_at 更新。
- 修改后查询结果立即生效。

### 5.6 删除记录

命令：

```shell
mepass delete --id 112783
```

功能：

- 根据 short_id 定位记录。
- 展示非敏感摘要。
- 要求用户输入 `yes` 确认。
- 删除记录。

验收标准：

- 未确认时不删除。
- 删除成功后无法再查询到该记录。

### 5.7 数据库位置

命令：

```shell
mepass status
```

功能：

- 展示数据库路径。
- 展示配置路径。
- 展示记录数量。
- 展示当前密钥来源：system-keychain 或 local-key-file。

## 6. 安全、迁移与便利性设计

### 6.1 主密码与可迁移性

mePass 必须使用用户自定义主密码。主密码不直接加密业务字段，而是用于派生密钥并加密随机数据密钥。

密钥结构：

```text
用户主密码 -> KDF -> 密钥加密密钥
随机数据密钥 -> 加密 password、apikey、note
密钥加密密钥 -> 加密随机数据密钥
```

数据库迁移到新设备后，只要用户知道主密码，就能解密数据库中的加密数据密钥，并重新绑定新设备。

### 6.2 本机免密码操作

初始化或迁移解锁成功后，程序将明文数据密钥绑定到当前设备。后续在同一台设备执行新增、查询、复制、删除等命令时，不再要求用户输入主密码。

密钥保存规则：

- macOS 使用 Keychain。
- Windows 使用 Credential Manager。
- Linux 使用 Secret Service/libsecret。
- 系统钥匙串不可用时，密钥保存到 `vault.key`，文件权限设置为 `0600`。

### 6.3 明文暴露控制

- username、baseurl、url、remark、tags 明文存储，用于快速检索。
- password、apikey、note 加密存储。
- 列表命令永不展示 password、apikey、note 明文。
- 查询命令只有在 `--reveal` 时展示敏感明文。
- 复制命令不打印敏感明文。
- 复制到剪贴板后，程序在 60 秒后尝试清空剪贴板。
- 错误日志不得打印 password、apikey、note 明文。

### 6.4 本地文件责任边界

- mePass 不处理云端同步。
- mePass 不内置同步协议。
- 用户自行备份或同步本地数据文件。
- 只同步 `mepass.db` 时，新设备首次使用需要输入主密码解锁。
- 同步 `mepass.db` 加 `vault.key` 时，新设备可能免输入主密码，但这等同于同步了解密材料。

## 7. CLI 设计

### 7.1 命令结构

```shell
mepass init
mepass add --type <account|email|api_key|note>
mepass list [--type type] [--tag tag] [--query keyword]
mepass get <keyword|short_id> [--type type] [--reveal] [--copy field]
mepass edit --id short_id
mepass delete --id short_id
mepass status
```

### 7.2 输出原则

- 默认输出适合人类阅读的表格。
- `--json` 输出结构化 JSON。
- 危险操作必须二次确认。
- 错误信息直接说明原因和下一步操作。

### 7.3 示例

```shell
mepass add --type api_key
mepass list --tag ai
mepass list --query gmail
mepass get openai --copy apikey
mepass get 112783 --reveal
mepass delete --id 112783
```

## 8. ID 设计

数据库内部主键使用 UUID，用户操作使用 6 位数字 short_id。

short_id 规则：

```text
[类型码][4 位随机序列][校验位]
```

类型编码：

| 类型 | 编码 |
| --- | --- |
| account | 0 |
| email | 1 |
| api_key | 2 |
| note | 3 |

校验位：

```text
check = (d1*3 + d2*5 + d3*7 + d4*9 + d5*11) % 10
```

生成时必须检查数据库唯一性，冲突时重新生成。

## 9. MVP 范围

第一版必须实现：

- `init`
- `add`
- `list`
- `get`
- `edit`
- `delete`
- `status`
- SQLite 存储
- 用户主密码初始化
- 数据密钥加密封装
- 本机自动解锁
- password、apikey、note AES-256-GCM 加密
- username、baseurl、url、remark、tags 模糊查询
- 多标签逗号存储和筛选
- 敏感字段复制到剪贴板
- `--json` 输出

不做：

- 云端账户。
- 云同步。
- 团队共享。
- 浏览器插件。
- 企业权限系统。

## 10. 成功指标

- 用户初始化后，本机日常操作无需反复输入密码。
- 用户迁移数据库到新设备后，可凭主密码恢复访问。
- 同一份 `mepass.db` 可在 macOS、Linux、Windows 间迁移使用。
- 用户可以在 3 分钟内完成初始化并添加第一条记录。
- 常见查询命令响应时间小于 300ms。
- 列表命令不会展示 password、apikey、note 明文。
- API Key 类型完整支持 baseurl 与 apikey 字段。
- username 支持模糊查询。
- 标签可通过逗号分割保存和筛选。
