import clipboardy from 'clipboardy'
import { execSync } from 'node:child_process'

let clearTimer: ReturnType<typeof setTimeout> | null = null

export async function copyToClipboard(text: string): Promise<void> {
  await clipboardy.write(text)
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(async () => {
    try {
      const current = await clipboardy.read()
      if (current === text) {
        await clipboardy.write('')
      }
    } catch {
      // ignore
    }
    clearTimer = null
  }, 60_000)
}
