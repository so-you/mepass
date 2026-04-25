# mePass 测试报告

## 测试时间

2026-04-25

## 测试环境

- 项目路径：`/Users/kyuu/develop-space/mePass`
- Node.js 要求：`>=20.0.0`
- 测试框架：Vitest
- TypeScript 编译：`tsc`

## 本次新增测试

### 1. 校验规则测试

文件：`tests/validation.test.ts`

覆盖内容：

- account 必填 `username`、`password`。
- api_key 必填 `baseurl`、`apikey`。
- 字段最大长度限制。
- 合法和非法 `type`。
- 非法 `short_id`。

### 2. Repository 查询测试

文件：`tests/repository.test.ts`

覆盖内容：

- username 明文模糊查询。
- query + type 组合筛选。
- 逗号分隔标签的边界匹配，避免部分字符串误命中。
- `limit` 和 `offset` 分页行为。

### 3. 安装脚本测试

文件：`tests/install-scripts.test.ts`

覆盖内容：

- macOS/Linux 安装脚本 artifact 命名规则。
- Windows 安装脚本必须将 zip 解压到目录，而不是 zip 文件路径。

## 本次修复

### Windows 安装脚本解压路径

文件：`install.ps1`

问题：

- 原脚本将 `$TempFile` 同时作为 zip 文件路径和解压目录使用。
- `Expand-Archive -DestinationPath $TempFile` 会把 zip 文件路径当作目录。
- 后续 `Copy-Item "$TempFile\mepass\*"` 路径不成立。

修复：

- 新增 `$TempDir = "$env:TEMP\mepass-install"`。
- 使用 `$TempDir` 作为解压目录。
- 安装完成后清理 `$TempDir`。

## 执行命令

```shell
npm run build
npm test
```

## 测试结果

### TypeScript 构建

结果：通过

```text
> mepass@1.0.0 build
> tsc
```

### Vitest

结果：通过

```text
Test Files  8 passed (8)
Tests       48 passed (48)
Duration    297ms
```

## 当前测试覆盖概况

已覆盖：

- AES-GCM 加密解密。
- 数据密钥加密封装和错误密码失败。
- short_id 生成和校验。
- 标签规范化。
- 基础输入校验。
- entries repository 的新增、查询、列表、编辑、删除、统计。
- username/baseurl 明文查询。
- password/apikey/note 加密存储断言。
- 安装脚本关键路径静态检查。

尚未覆盖：

- 真实交互式 CLI 端到端流程。
- 系统钥匙串真实读写。
- Windows Credential Manager 真实行为。
- Linux Secret Service/libsecret 真实行为。
- 多进程并发写数据库。
- 剪贴板 60 秒自动清理的真实跨进程行为。

## 结论

当前代码通过构建和全部自动化测试。新增测试补强了校验、查询边界和安装脚本风险点。下一阶段应优先补充真实 CLI 端到端测试和跨平台 key-store 集成测试。
