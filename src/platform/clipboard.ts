import clipboardy from 'clipboardy'
import { execSync, spawn } from 'node:child_process'

export async function copyToClipboard(text: string): Promise<void> {
  await clipboardy.write(text)
  scheduleClear(text)
}

function scheduleClear(originalText: string): void {
  const escaped = originalText.replace(/'/g, "'\\''")
  if (process.platform === 'darwin') {
    const cmd = `sleep 60 && current=$(pbpaste) && [ "$current" = '${escaped}' ] && printf "" | pbcopy || true`
    spawn('bash', ['-c', cmd], { stdio: 'ignore', detached: true }).unref()
  } else if (process.platform === 'linux') {
    const cmd = `sleep 60 && current=$(xclip -selection clipboard -o 2>/dev/null) && [ "$current" = '${escaped}' ] && printf "" | xclip -selection clipboard 2>/dev/null || true`
    spawn('bash', ['-c', cmd], { stdio: 'ignore', detached: true }).unref()
  } else if (process.platform === 'win32') {
    const psEscaped = originalText.replace(/'/g, "''")
    const cmd = `Start-Sleep 60; $cur = Get-Clipboard -Raw; if ($cur -eq '${psEscaped}') { Set-Clipboard -Value '' }`
    spawn('powershell', ['-Command', cmd], { stdio: 'ignore', detached: true }).unref()
  }
}
