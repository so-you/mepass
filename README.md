# mePass

mePass 是一款面向个人开发者和命令行用户的本地密码与敏感信息管理工具。它通过 CLI 管理账号密码、邮箱密码、API Key 和加密笔记，数据默认保存在本机 SQLite 数据库中，password、apikey、note 使用认证加密算法加密存储。

mePass 支持 macOS、Linux、Windows 三个桌面系统。

## 文档

- [产品设计说明书](docs/product-design.md)
- [技术方案文档](docs/technical-solution.md)

## 核心定位

- 本地优先：不依赖云端服务即可使用。
- 命令行友好：适合开发者日常终端工作流。
- 免密码操作：初始化时设置一次用户主密码，本机完成钥匙串绑定后无需反复输入密码。
- 加密存储：password、apikey、note 加密存储。
- 明文检索：username、baseurl、url、remark、tags 支持模糊查询。
- 标签检索：支持按类型、标签和关键字快速定位记录。
- 跨平台：同一套 CLI 规格支持 macOS、Linux、Windows。

## 命令形态

```shell
mepass init
mepass add --type account
mepass add --type email
mepass add --type api_key
mepass add --type note
mepass list --type email
mepass list --tag ai
mepass list --query gmail
mepass get openai --copy apikey
mepass delete --id 112783
```

## 关键设计决策

mePass 是个人本地工具，便利性优先：

1. 初始化时由用户设置主密码，主密码用于跨设备迁移和恢复。
2. 程序生成随机数据密钥，用数据密钥加密 password、apikey、note。
3. 使用用户主密码派生密钥并加密数据密钥，加密后的数据密钥随数据库保存。
4. 本机日常免输入密码：数据密钥优先保存到系统钥匙串；钥匙串不可用时保存到本地 key file。
5. 迁移到新设备后，用户输入主密码即可解锁数据库并重新绑定新设备。
6. username 明文存储并支持模糊查询。
7. API Key 类型包含 `baseurl` 和 `apikey` 字段，其中 `apikey` 加密存储。
8. 标签以英文逗号分割存储，例如 `ai,openai,work`。
9. 不实现云端账户和云同步；用户自行同步或备份数据库文件。

