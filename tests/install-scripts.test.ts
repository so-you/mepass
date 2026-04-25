import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('install scripts', () => {
  it('macOS/Linux installer clones from git and builds locally', () => {
    const script = fs.readFileSync('install.sh', 'utf8')

    expect(script).toContain('git clone')
    expect(script).toContain('npm ci')
    expect(script).toContain('./node_modules/.bin/tsc')
    expect(script).toContain('npm prune --omit=dev')
    expect(script).toContain('node "${INSTALL_DIR}/dist/cli.js"')
  })

  it('Windows installer clones from git and builds locally', () => {
    const script = fs.readFileSync('install.ps1', 'utf8')

    expect(script).toContain('git clone')
    expect(script).toContain('npm ci')
    expect(script).toContain('node_modules/typescript/bin/tsc')
    expect(script).toContain('npm prune --omit=dev')
    expect(script).toContain('%APPDATA%\\mePass\\app\\dist\\cli.js')
  })
})
