#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { addCommand } from './commands/add.js'
import { listCommand } from './commands/list.js'
import { getCommand } from './commands/get.js'
import { editCommand } from './commands/edit.js'
import { deleteCommand } from './commands/delete.js'
import { statusCommand } from './commands/status.js'
import { backupCommand } from './commands/backup.js'
import { MePassError } from './types/entry.js'

const program = new Command()

program
  .name('mepass')
  .description('mePass - 本地密码与敏感信息管理 CLI 工具\n\n安全存储账号密码、邮箱密码、API Key 和加密笔记。\n所有数据保存在本地 SQLite 数据库，敏感字段 AES-256-GCM 加密。\n\n快速开始:\n  mepass init          初始化\n  mepass add -k        添加 API Key\n  mepass list          查看所有记录\n  mepass get openai    查询记录')
  .version('1.0.0')

program
  .command('init')
  .description('初始化 mePass，创建本地数据库和加密密钥')
  .usage('')
  .action(wrap(initCommand))

program
  .command('add')
  .description('新增一条记录（交互式输入）')
  .usage('-a | -e | -k | -n | --type <类型>')
  .addHelpText('after', `
类型说明:
  account    平台账号密码（name, username, password）
  email      邮箱账号密码（name, username, password）
  api_key    API Key（name, baseurl, apikey）
  note       加密笔记（name, note）

示例:
  mepass add -k              添加 API Key
  mepass add -a              添加账号
  mepass add --type email    添加邮箱`)
  .option('-t, --type <type>', '记录类型 (account|email|api_key|note)')
  .option('-a', '快捷添加 account')
  .option('-e', '快捷添加 email')
  .option('-k', '快捷添加 api_key')
  .option('-n', '快捷添加 note')
  .action(wrap(async (opts: { type?: string; a?: boolean; e?: boolean; k?: boolean; n?: boolean }) => {
    let type = opts.type
    if (opts.a) type = 'account'
    else if (opts.e) type = 'email'
    else if (opts.k) type = 'api_key'
    else if (opts.n) type = 'note'

    if (!type) {
      console.log('请指定类型：--type account|email|api_key|note 或使用 -a/-e/-k/-n')
      return
    }
    await addCommand(type)
  }))

program
  .command('list')
  .description('列出记录（不展示敏感字段）')
  .usage('[选项]')
  .addHelpText('after', `
筛选条件可组合使用:
  mepass list                          列出所有
  mepass list --type api_key           按类型筛选
  mepass list --tag ai                 按标签筛选
  mepass list --query gmail            模糊搜索
  mepass list --tag ai --json          JSON 输出`)
  .option('-t, --type <type>', '按类型筛选 (account|email|api_key|note)')
  .option('--tag <tag>', '按标签筛选')
  .option('-q, --query <query>', '模糊搜索 name/username/baseurl/url/remark/tags')
  .option('--limit <limit>', '每页数量', '50')
  .option('--offset <offset>', '分页偏移', '0')
  .option('--json', 'JSON 格式输出')
  .action(wrap(async (opts: { type?: string; tag?: string; query?: string; limit?: string; offset?: string; json?: boolean }) => {
    await listCommand({
      type: opts.type,
      tag: opts.tag,
      query: opts.query,
      limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
      offset: opts.offset ? parseInt(opts.offset, 10) : undefined,
      json: opts.json,
    })
  }))

program
  .command('get')
  .description('查询记录详情（默认展示敏感字段明文）')
  .usage('<keyword|short_id> [选项]')
  .addHelpText('after', `
查询方式:
  short_id 精确查询    mepass get 297198
  关键字模糊查询       mepass get openai
  限定类型查询         mepass get gmail --type email

复制到剪贴板:
  mepass get 297198 --copy apikey     复制 API Key
  mepass get 297198 --copy password   复制密码
  mepass get 297198 --copy note       复制笔记
  mepass get 297198 --json            JSON 格式输出

多条匹配时会以列表展示，请用 short_id 精确查询。`)
  .argument('<query>', 'short_id 或搜索关键字')
  .option('-t, --type <type>', '限定搜索类型 (account|email|api_key|note)')
  .option('--json', 'JSON 格式输出')
  .option('--copy <field>', '复制字段到剪贴板 (password|apikey|note)')
  .action(wrap(async (query: string, opts: { type?: string; reveal?: boolean; copy?: string; json?: boolean }) => {
    await getCommand(query, opts)
  }))

program
  .command('edit')
  .description('交互式编辑记录（回车保留原值）')
  .usage('--id <short_id>')
  .addHelpText('after', `
示例:
  mepass edit --id 297198`)
  .requiredOption('--id <shortId>', '记录 short_id')
  .action(wrap(async (opts: { id: string }) => {
    await editCommand(opts.id)
  }))

program
  .command('delete')
  .description('删除记录（需二次确认）')
  .usage('--id <short_id>')
  .addHelpText('after', `
示例:
  mepass delete --id 297198`)
  .requiredOption('--id <shortId>', '记录 short_id')
  .action(wrap(async (opts: { id: string }) => {
    await deleteCommand(opts.id)
  }))

program
  .command('status')
  .description('显示数据库路径、密钥来源和记录统计')
  .usage('')
  .action(wrap(statusCommand))

program
  .command('backup')
  .description('备份数据库（按日期命名，重复执行覆盖当天备份）')
  .usage('')
  .action(wrap(backupCommand))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(fn: (...args: any[]) => Promise<void>): (...args: any[]) => Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      await fn(...args)
    } catch (err) {
      if (err instanceof MePassError) {
        console.error(`错误：${err.message}`)
      } else if (err instanceof Error && err.message === 'DECRYPT_FAILED') {
        console.error('错误：敏感字段解密失败，请检查密钥是否匹配')
      } else if (err instanceof Error) {
        console.error(`错误：${err.message}`)
      } else {
        console.error('发生未知错误')
      }
      process.exit(1)
    }
  }
}

program.parse()
