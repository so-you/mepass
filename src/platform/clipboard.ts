import clipboardy from 'clipboardy'
import { spawn } from 'node:child_process'

export async function copyToClipboard(text: string): Promise<void> {
  await clipboardy.write(text)
  scheduleClear()
}

function scheduleClear(): void {
  let cmd: string
  if (process.platform === 'darwin') {
    cmd = 'sleep 60 && printf "" | pbcopy'
    spawn('bash', ['-c', cmd], { stdio: 'ignore', detached: true }).unref()
  } else if (process.platform === 'linux') {
    cmd = 'sleep 60 && printf "" | xclip -selection clipboard 2>/dev/null'
    spawn('bash', ['-c', cmd], { stdio: 'ignore', detached: true }).unref()
  } else if (process.platform === 'win32') {
    spawn('powershell', ['-Command', 'Start-Sleep 60; Set-Clipboard -Value ""'], {
      stdio: 'ignore', detached: true,
    }).unref()
  }
}
