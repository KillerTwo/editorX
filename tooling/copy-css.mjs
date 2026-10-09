// Usage: node copy-css.mjs [srcFile] [destFile] — paths resolve against process.cwd() (the package dir)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const [srcArg = 'src/styles.css', destArg = 'dist/styles.css'] = process.argv.slice(2)
const src = path.resolve(process.cwd(), srcArg)
const dest = path.resolve(process.cwd(), destArg)

if (!existsSync(src)) {
  process.stdout.write(`[copy-css] ${srcArg} not found, skipping\n`)
  process.exit(0)
}

mkdirSync(path.dirname(dest), { recursive: true })
copyFileSync(src, dest)
