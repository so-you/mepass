import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('install scripts', () => {
  it('macOS/Linux installer references the release artifact naming convention', () => {
    const script = fs.readFileSync('install.sh', 'utf8')

    expect(script).toContain('ARTIFACT="mepass-${PLATFORM}-${ARCH}.tar.gz"')
    expect(script).toContain('https://github.com/${REPO}/releases/download/${LATEST}/${ARTIFACT}')
  })

  it('Windows installer extracts zip into a directory, not into the zip file path', () => {
    const script = fs.readFileSync('install.ps1', 'utf8')

    expect(script).toContain('$TempDir = "$env:TEMP\\mepass-install"')
    expect(script).toContain('Expand-Archive -Path $TempFile -DestinationPath $TempDir -Force')
    expect(script).toContain('Copy-Item -Recurse "$TempDir\\mepass\\*" $InstallDir')
  })
})

