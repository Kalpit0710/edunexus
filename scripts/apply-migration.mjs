import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const lines = readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split(/\r?\n/)
  return Object.fromEntries(
    lines
      .filter((l) => /^\s*[^#]\S+=/.test(l))
      .map((l) => {
        const [k, ...v] = l.split('=')
        return [k.trim(), v.join('=').trim()]
      })
  )
}

const env = loadEnv()
const token = env.SUPABASE_ACCESS_TOKEN
const ref = 'dgmqcrhogtbkzkprzjor'

if (!token) {
  console.error('No SUPABASE_ACCESS_TOKEN found in .env.local')
  process.exit(1)
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration.mjs <path-to-sql>')
  process.exit(1)
}

const sql = readFileSync(resolve(__dirname, '..', migrationFile), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

console.log('HTTP', res.status)
const text = await res.text()
console.log(text || '(empty response)')
if (!res.ok) process.exit(1)
console.log('Migration applied successfully.')
