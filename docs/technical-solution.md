# mePass 技术方案文档

## 1. 技术目标

mePass 是个人本地 CLI 工具。技术实现必须围绕以下目标展开：

- 支持 macOS、Linux、Windows。
- 初始化时用户必须设置主密码；同一设备完成密钥绑定后，日常命令无需反复输入密码。
- 数据库迁移到新设备后，用户可通过主密码解锁并重新绑定设备。
- 所有业务数据保存在 SQLite 单文件数据库中。
- username、baseurl、url、remark、tags 明文存储并支持模糊查询。
- password、apikey、note 使用 AES-256-GCM 加密存储。
- 标签使用一个逗号分隔字符串字段保存，不拆分标签关联表。
- 文档中的结构、字段和命令即为实现规格。

## 2. 技术栈

| 模块 | 技术选型 | 说明 |
| --- | --- | --- |
| 运行环境 | Node.js 20+ | 使用 TypeScript 与 ESM |
| CLI 框架 | commander | 定义命令、参数、帮助信息 |
| 交互输入 | @inquirer/prompts | 表单、隐藏输入、确认、选择列表 |
| 本地数据库 | SQLite | 单文件本地存储 |
| SQLite 驱动 | better-sqlite3 | 同步 API，适合 CLI |
| 加密 | Node crypto AES-256-GCM | 加密 password、apikey、note |
| 数据密钥生成 | crypto.randomBytes(32) | 初始化时生成随机数据密钥 |
| 主密码 KDF | scrypt | 从用户主密码派生密钥加密密钥 |
| 系统密钥保存 | keytar | 保存本机数据密钥 |
| 本地密钥兜底 | 0600 权限 key file | keytar 不可用时使用 |
| 剪贴板 | clipboardy | 复制敏感字段 |
| 表格输出 | table 或 cli-table3 | 人类可读列表 |
| 测试 | vitest | 单元测试和集成测试 |

## 3. 目录结构

```text
mePass/
  package.json
  tsconfig.json
  src/
    cli.ts
    commands/
      init.ts
      add.ts
      list.ts
      get.ts
      edit.ts
      delete.ts
      status.ts
    core/
      crypto.ts
      key-store.ts
      short-id.ts
      validation.ts
      tags.ts
    db/
      connection.ts
      migrations.ts
      schema.sql
      entries-repository.ts
    platform/
      clipboard.ts
      paths.ts
    types/
      entry.ts
  tests/
    crypto.test.ts
    key-store.test.ts
    short-id.test.ts
    tags.test.ts
    commands.test.ts
  docs/
    product-design.md
    technical-solution.md
```

## 4. 本地文件位置

程序按操作系统创建应用数据目录。

| 系统 | 数据目录 |
| --- | --- |
| macOS | `~/Library/Application Support/mePass/` |
| Linux | `~/.local/share/mepass/` |
| Windows | `%APPDATA%/mePass/` |

文件：

```text
mepass.db
config.json
vault.key
```

说明：

- `mepass.db` 保存业务数据。
- `config.json` 保存非敏感配置，例如数据库版本、剪贴板清理秒数、密钥来源和 KDF 参数。
- `vault.key` 只在系统钥匙串不可用时创建，保存 base64 编码的数据密钥，权限必须设置为 `0600`。

## 4.1 跨平台实现要求

支持平台：

| 平台 | Node 标识 | 系统密钥后端 | 数据目录 |
| --- | --- | --- | --- |
| macOS | `darwin` | Keychain | `~/Library/Application Support/mePass/` |
| Linux | `linux` | Secret Service/libsecret | `~/.local/share/mepass/` |
| Windows | `win32` | Credential Manager | `%APPDATA%/mePass/` |

实现要求：

- `platform/paths.ts` 必须根据 `process.platform` 返回数据目录、数据库路径、配置路径和 `vault.key` 路径。
- `key-store.ts` 必须优先使用 keytar；keytar 在三个平台上分别映射到系统密钥后端。
- Linux 环境没有可用 Secret Service 时，必须自动 fallback 到 `vault.key`。
- Windows 的 `vault.key` 权限不能使用 POSIX `0600` 作为唯一保护方式；实现需写入用户 AppData 目录，并尽量通过 Node 文件权限限制当前用户访问。
- 所有路径处理必须使用 `path.join`，不得拼接 `/` 或 `\`。
- SQLite schema、加密字段格式、KDF 参数、short_id 和 tags 格式在三个平台完全一致。
- `mepass.db` 从任意平台复制到另一平台后，输入主密码即可恢复。
- 剪贴板复制使用 `clipboardy`，三个平台命令行为一致。

## 5. 数据库设计

### 5.1 Schema

```sql
CREATE TABLE IF NOT EXISTS vault_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  short_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('account', 'email', 'api_key', 'note')),
  name TEXT NOT NULL,
  username TEXT,
  password_cipher TEXT,
  password_iv TEXT,
  password_auth_tag TEXT,
  baseurl TEXT,
  apikey_cipher TEXT,
  apikey_iv TEXT,
  apikey_auth_tag TEXT,
  url TEXT,
  note_cipher TEXT,
  note_iv TEXT,
  note_auth_tag TEXT,
  remark TEXT,
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_short_id ON entries(short_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_name ON entries(name);
CREATE INDEX IF NOT EXISTS idx_entries_username ON entries(username);
CREATE INDEX IF NOT EXISTS idx_entries_baseurl ON entries(baseurl);
CREATE INDEX IF NOT EXISTS idx_entries_url ON entries(url);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries(tags);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
```

### 5.2 字段规格

| 字段 | 类型 | 加密 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | UUID |
| short_id | TEXT | 否 | 6 位数字用户可见 ID |
| type | TEXT | 否 | account/email/api_key/note |
| name | TEXT | 否 | 平台、服务或记录名称 |
| username | TEXT | 否 | 账号名或邮箱地址，支持模糊查询 |
| password_cipher | TEXT | 是 | account/email 密码密文 |
| password_iv | TEXT | 否 | password 加密 IV |
| password_auth_tag | TEXT | 否 | password GCM tag |
| baseurl | TEXT | 否 | API 服务基础地址，支持模糊查询 |
| apikey_cipher | TEXT | 是 | API Key 密文 |
| apikey_iv | TEXT | 否 | apikey 加密 IV |
| apikey_auth_tag | TEXT | 否 | apikey GCM tag |
| url | TEXT | 否 | 登录页或平台地址 |
| note_cipher | TEXT | 是 | note 正文密文 |
| note_iv | TEXT | 否 | note 加密 IV |
| note_auth_tag | TEXT | 否 | note GCM tag |
| remark | TEXT | 否 | 非敏感备注 |
| tags | TEXT | 否 | 英文逗号分隔标签 |
| created_at | TEXT | 否 | ISO 8601 时间 |
| updated_at | TEXT | 否 | ISO 8601 时间 |
| last_accessed_at | TEXT | 否 | ISO 8601 时间 |

### 5.3 类型字段约束

程序层校验：

| type | 必填字段 | 必须为空或忽略字段 |
| --- | --- | --- |
| account | name, username, password | baseurl, apikey, note |
| email | name, username, password | baseurl, apikey, note |
| api_key | name, baseurl, apikey | username, password, url, note |
| note | name, note | username, password, baseurl, apikey, url |

## 6. 标签实现

标签使用 `entries.tags` 单字段保存，格式为英文逗号分隔字符串。

规范化函数 `normalizeTags(input: string[] | string, type: EntryType): string`：

1. 接收用户输入字符串或数组。
2. 若为字符串，按英文逗号 `,` 分割。
3. 每个标签执行 trim。
4. 移除开头的 `#`。
5. 转小写。
6. 过滤空字符串。
7. 加入类型标签。
8. 去重。
9. 按字母序排序。
10. 使用英文逗号拼接。

示例：

```text
输入："#AI, openai, ai"
类型："api_key"
保存："ai,api_key,openai"
```

标签查询：

```sql
WHERE tags = ?
   OR tags LIKE ?
   OR tags LIKE ?
   OR tags LIKE ?
```

参数规则：

- 完全匹配：`ai`
- 开头匹配：`ai,%`
- 中间匹配：`%,ai,%`
- 结尾匹配：`%,ai`

## 7. 加密、迁移与自动解锁

### 7.1 密钥结构

mePass 使用信封加密：

```text
masterPassword -> scrypt -> keyEncryptionKey
dataKey -> AES-256-GCM -> password/apikey/note
keyEncryptionKey -> AES-256-GCM -> encryptedDataKey
```

说明：

- `masterPassword` 由用户初始化时自定义。
- `dataKey` 是 32 字节随机密钥，用于加密业务敏感字段。
- `keyEncryptionKey` 由主密码通过 scrypt 派生，仅用于加密和解密 `dataKey`。
- `encryptedDataKey` 保存到 `vault_meta`，随数据库迁移。

### 7.2 初始化密钥流程

初始化时：

1. 用户输入主密码并二次确认。
2. 生成 32 字节随机 `dataKey`。
3. 生成 16 字节随机 `kdfSalt`。
4. 使用 scrypt 从主密码派生 32 字节 `keyEncryptionKey`。
5. 使用 AES-256-GCM 加密 `dataKey`，得到 `encryptedDataKey`。
6. 将 `encryptedDataKey`、IV、auth tag、KDF 参数和 salt 写入 `vault_meta`。
7. 将明文 `dataKey` 保存到本机 key-store，用于后续免输入主密码。

```ts
const dataKey = crypto.randomBytes(32)
```

KDF 参数：

```ts
{
  algorithm: 'scrypt',
  keyLength: 32,
  N: 32768,
  r: 8,
  p: 1
}
```

### 7.3 本机 key-store

`key-store.ts` 实现统一接口：

```ts
interface KeyStore {
  getKey(): Promise<Buffer | null>
  saveKey(key: Buffer): Promise<void>
  getSource(): Promise<'system-keychain' | 'local-key-file'>
}
```

保存规则：

1. 优先使用 keytar 写入系统钥匙串。
2. keytar 不可用或写入失败时，写入 `vault.key`。
3. `vault.key` 内容为 base64 编码的 32 字节密钥。
4. `vault.key` 文件权限必须设置为 `0600`。
5. `config.json` 记录密钥来源。

keytar service/account：

```text
service: mePass
account: default-vault-key
```

### 7.4 自动解锁流程

每次命令启动时：

1. 解析数据目录。
2. 读取或创建数据库连接。
3. 从 key-store 读取数据密钥。
4. 如果读取成功，直接执行命令。
5. 如果密钥不存在且数据库未初始化，提示执行 `mepass init`。
6. 如果密钥不存在但数据库已存在，提示用户输入主密码。
7. 使用主密码解密 `vault_meta` 中的 `encryptedDataKey`。
8. 解密成功后将 dataKey 保存到本机 key-store。
9. 继续执行命令。

### 7.5 迁移解锁流程

迁移到新设备时，用户只需要带走 `mepass.db`。

首次执行需要解密敏感字段的命令时：

1. 程序发现 key-store 中没有 dataKey。
2. 程序提示输入主密码。
3. 程序读取 `vault_meta.encrypted_data_key`、`vault_meta.kdf_salt`、`vault_meta.kdf_params`。
4. 程序派生 `keyEncryptionKey`。
5. 程序解密 `dataKey`。
6. 程序将 `dataKey` 保存到新设备 key-store。
7. 后续命令不再要求输入主密码。

### 7.6 AES-GCM 字段格式

加密函数：

```ts
encryptText(plainText: string, key: Buffer): EncryptedField
```

返回：

```ts
type EncryptedField = {
  cipher: string
  iv: string
  authTag: string
}
```

规则：

- 算法：`aes-256-gcm`
- IV：每次加密生成 12 字节随机值。
- 输出编码：base64。
- 空值不加密，保存为 NULL。

解密函数：

```ts
decryptText(field: EncryptedField, key: Buffer): string
```

解密失败时返回业务错误 `DECRYPT_FAILED`，错误信息不包含密文和明文。

## 8. 短 ID 实现

短 ID 为 6 位数字：

```text
[类型码][4 位随机序列][校验位]
```

类型码：

| 类型 | 类型码 |
| --- | --- |
| account | 0 |
| email | 1 |
| api_key | 2 |
| note | 3 |

校验位：

```ts
check = (d1 * 3 + d2 * 5 + d3 * 7 + d4 * 9 + d5 * 11) % 10
```

生成流程：

1. 根据类型写入第 1 位。
2. 生成 4 位随机数字。
3. 计算校验位。
4. 查询 `entries.short_id` 是否存在。
5. 冲突则重试。
6. 最大重试 100 次，仍失败则抛出 `SHORT_ID_GENERATION_FAILED`。

## 9. 查询实现

### 9.1 list 查询

基础 SQL：

```sql
SELECT
  short_id,
  type,
  name,
  username,
  baseurl,
  url,
  remark,
  tags,
  updated_at
FROM entries
WHERE 1 = 1
ORDER BY updated_at DESC
LIMIT ? OFFSET ?;
```

筛选条件：

- `--type`：`AND type = ?`
- `--tag`：使用标签匹配条件。
- `--query`：对 `name`、`username`、`baseurl`、`url`、`remark`、`tags` 使用 `LIKE`。
- 所有查询参数必须使用 prepared statement 绑定，不拼接用户输入。

`--query` SQL 片段：

```sql
AND (
  name LIKE ?
  OR username LIKE ?
  OR baseurl LIKE ?
  OR url LIKE ?
  OR remark LIKE ?
  OR tags LIKE ?
)
```

`--query` 参数值：

```text
%<query>%
```

### 9.2 get 查询

判断 query 是否为合法 short_id：

- 是：按 `short_id = ?` 精确查询。
- 否：执行模糊查询。

模糊查询字段：

- name
- username
- baseurl
- url
- remark
- tags

多条结果：

- 通过 inquirer select 展示候选项。
- 候选项格式：`[short_id] type name username/baseurl tags`。

`--type` 存在时，get 查询必须追加 `AND type = ?`。

## 10. 命令实现

### 10.1 `init`

流程：

1. 创建数据目录。
2. 创建或打开 `mepass.db`。
3. 执行 schema migration。
4. 要求用户输入主密码并二次确认。
5. 生成 32 字节 dataKey。
6. 使用 scrypt 派生 keyEncryptionKey。
7. 使用 keyEncryptionKey 加密 dataKey。
8. 将 dataKey 保存到本机 key-store。
9. 写入 `vault_meta`：
   - `schema_version`
   - `created_at`
   - `key_source`
   - `kdf_algorithm`
   - `kdf_params`
   - `kdf_salt`
   - `encrypted_data_key_cipher`
   - `encrypted_data_key_iv`
   - `encrypted_data_key_auth_tag`
10. 输出数据库路径和密钥来源。

### 10.2 `add`

流程：

1. 解析 `--type`。
2. 自动读取数据密钥；如本机 key-store 缺失，则提示输入主密码并重新绑定本机。
3. 按类型询问字段。
4. 规范化 tags。
5. 生成 UUID。
6. 生成 short_id。
7. 加密敏感字段。
8. 插入 entries。
9. 输出 short_id。

各类型输入：

account/email：

- name
- username
- password
- url
- remark
- tags

api_key：

- name
- baseurl
- apikey
- remark
- tags

note：

- name
- note
- remark
- tags

### 10.3 `list`

流程：

1. 解析 `--type`、`--tag`、`--query`、`--limit`、`--offset`、`--json`。
2. 拼接参数化 SQL。
3. 查询非敏感字段。
4. 输出表格或 JSON。

输出字段：

- short_id
- type
- name
- username
- baseurl
- url
- tags
- updated_at

### 10.4 `get`

参数：

```shell
mepass get <query> [--type type] [--reveal] [--copy password|apikey|note] [--json]
```

流程：

1. 查询候选记录。
2. 多条结果时用户选择。
3. 更新 `last_accessed_at`。
4. 未传 `--reveal` 和 `--copy` 时，仅输出非敏感字段。
5. 传 `--reveal` 时解密并输出适用敏感字段。
6. 传 `--copy` 时解密对应字段并写入剪贴板。
7. 复制后启动 60 秒延迟清理剪贴板。

字段映射：

| type | 可 reveal/copy 字段 |
| --- | --- |
| account | password |
| email | password |
| api_key | apikey |
| note | note |

### 10.5 `edit`

流程：

1. 使用 `--id` 查询记录。
2. 展示当前非敏感字段。
3. 按类型进入编辑表单。
4. 空输入表示保留原值。
5. 新敏感字段不为空时重新加密。
6. tags 不为空时重新规范化。
7. 更新 `updated_at`。

### 10.6 `delete`

流程：

1. 使用 `--id` 查询记录。
2. 展示 short_id、type、name、username/baseurl、tags。
3. 要求输入 `yes`。
4. 删除 entries 对应记录。

### 10.7 `status`

输出：

- 数据目录。
- 数据库路径。
- 配置路径。
- 密钥来源。
- 总记录数。
- 各类型记录数。

## 11. 校验规则

| 场景 | 规则 |
| --- | --- |
| type | 必须是 account/email/api_key/note |
| name | 必填，1-80 字符 |
| username | account/email 必填，1-120 字符 |
| password | account/email 必填，1-1000 字符 |
| baseurl | api_key 必填，1-300 字符 |
| apikey | api_key 必填，1-4000 字符 |
| note | note 必填，1-5000 字符 |
| url | 可空；非空时 1-300 字符 |
| remark | 可空；最多 1000 字符 |
| tags | 可空；规范化后最多 500 字符 |
| short_id | 6 位数字且校验位正确 |

## 12. 错误处理

错误码：

| 错误码 | 场景 | 用户提示 |
| --- | --- | --- |
| NOT_INITIALIZED | 未初始化 | 请先执行 `mepass init` |
| KEY_MISSING | 本机密钥缺失，且数据库内 encryptedDataKey 不存在或不可用 | 找不到可用解密材料，请检查数据库完整性 |
| INVALID_TYPE | 类型错误 | type 仅支持 account/email/api_key/note |
| VALIDATION_FAILED | 输入不合法 | 展示具体字段错误 |
| NOT_FOUND | 查询为空 | 未找到匹配记录 |
| DECRYPT_FAILED | 解密失败 | 敏感字段解密失败，请检查密钥是否匹配 |
| SHORT_ID_INVALID | short_id 不合法 | short_id 必须为 6 位有效数字 |
| SHORT_ID_GENERATION_FAILED | short_id 生成失败 | 生成短 ID 失败，请重试 |

日志规则：

- 日志不得包含 password、apikey、note 明文。
- 默认不输出堆栈。
- `--debug` 时可输出堆栈，但仍不得输出敏感明文。

## 13. 测试策略

### 13.1 单元测试

- AES-GCM 加密解密。
- 密文篡改后解密失败。
- key-store 读取、保存和 fallback。
- short_id 生成、校验和冲突重试。
- tags 规范化。
- 类型字段校验。

### 13.2 集成测试

- `init` 后自动生成数据库和密钥。
- `add account` 后 username 明文可查，password 数据库中不出现明文。
- `add api_key` 后 baseurl 明文可查，apikey 数据库中不出现明文。
- `list --query` 可匹配 username/baseurl/tags。
- `get --copy apikey` 能复制 API Key 且不打印明文。
- `edit` 能更新明文字段和加密字段。
- `delete` 确认后删除记录。
- 初始化必须提示设置主密码。
- 同一设备完成 key-store 绑定后，日常命令不提示输入主密码。
- 迁移到新设备后，首次解锁提示输入主密码，之后不再提示。

### 13.3 数据库断言

测试必须直接读取 SQLite 验证：

- `username` 为明文。
- `baseurl` 为明文。
- `password_cipher` 不等于原 password。
- `apikey_cipher` 不等于原 apikey。
- `note_cipher` 不等于原 note。
- `tags` 为规范化逗号分隔字符串。

## 14. MVP 交付范围

必须交付：

- TypeScript CLI 项目。
- SQLite schema 和 migration。
- 自动密钥生成、保存、读取。
- 用户主密码设置与迁移解锁。
- encryptedDataKey 写入 `vault_meta`。
- AES-256-GCM 加密工具。
- `init/add/list/get/edit/delete/status` 命令。
- account/email/api_key/note 四种类型。
- api_key 的 `baseurl` 和 `apikey` 字段。
- username 明文存储与模糊查询。
- 标签逗号分隔存储与筛选。
- 剪贴板复制和 60 秒清理。
- 表格输出和 `--json` 输出。
- Vitest 测试。

不交付：

- 云同步。
- 云端账户。
- 团队共享。
- 浏览器插件。
- 企业权限审计。

## 15. 实施顺序

1. 初始化 TypeScript CLI 项目。
2. 实现 paths、config 和 SQLite connection。
3. 实现 schema migration。
4. 实现 scrypt KDF 和 encryptedDataKey 封装。
5. 实现 key-store 自动密钥保存与读取。
6. 实现 AES-256-GCM 加密解密。
7. 实现 tags 与 short-id 工具。
8. 实现 entries repository。
9. 实现 `init`。
10. 实现 `add`。
11. 实现 `list` 和查询条件。
12. 实现 `get`、`--reveal`、`--copy`。
13. 实现 `edit`。
14. 实现 `delete`。
15. 实现 `status`。
16. 补齐测试和 README 示例。
