#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { addCommand } from './commands/add.js'
import { listCommand } from './commands/list.js'
import { getCommand } from './commands/get.js'
import { editCommand } from './commands/edit.js'
import { deleteCommand } from './commands/delete.js'
import { statusCommand } from './commands/status.js'
import { MePassError } from './types/entry.js'

const program = new Command()

program
  .name('mepass')
  .description('本地密码与敏感信息管理工具')
  .version('1.0.0')

program
  .command('init')
  .description('初始化 mePass，创建数据库和密钥')
  .action(wrap(initCommand))

program
  .command('add')
  .description('新增一条记录')
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
  .description('列出记录')
  .option('-t, --type <type>', '按类型筛选')
  .option('--tag <tag>', '按标签筛选')
  .option('-q, --query <query>', '模糊查询')
  .option('--limit <limit>', '每页数量', '50')
  .option('--offset <offset>', '偏移量', '0')
  .option('--json', 'JSON 输出')
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
  .command('get <query>')
  .description('查询记录')
  .option('-t, --type <type>', '按类型筛选')
  .option('--reveal', '显示敏感字段明文')
  .option('--copy <field>', '复制字段到剪贴板 (password|apikey|note)')
  .option('--json', 'JSON 输出')
  .action(wrap(async (query: string, opts: { type?: string; reveal?: boolean; copy?: string; json?: boolean }) => {
    await getCommand(query, opts)
  }))

program
  .command('edit')
  .description('编辑记录')
  .requiredOption('--id <shortId>', '记录 short_id')
  .action(wrap(async (opts: { id: string }) => {
    await editCommand(opts.id)
  }))

program
  .command('delete')
  .description('删除记录')
  .requiredOption('--id <shortId>', '记录 short_id')
  .action(wrap(async (opts: { id: string }) => {
    await deleteCommand(opts.id)
  }))

program
  .command('status')
  .description('显示数据库和密钥状态')
  .action(wrap(statusCommand))

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
