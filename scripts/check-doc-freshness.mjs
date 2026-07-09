import { readFileSync } from 'node:fs'

const MAX_AGE_DAYS = Number(process.env.DOC_FRESHNESS_MAX_DAYS ?? '60')

const DOCS_WITH_LAST_UPDATED = [
  'Documentation/ARCHITECTURE.md',
  'Documentation/SECURITY.md',
  'Documentation/UI_UX_GUIDELINES.md',
]

const PROGRESS_FILE = 'Documentation/PROGRESS.md'
const TODAY = new Date()

function parseIsoDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`)
  }
  return parsed
}

function ageDays(from) {
  return Math.floor((TODAY.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function extractLastUpdated(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const match = content.match(/Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/)
  if (!match) {
    throw new Error(`${filePath}: missing 'Last Updated: YYYY-MM-DD' marker`)
  }
  return parseIsoDate(match[1])
}

function extractLatestProgressEntryDate(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const matches = [...content.matchAll(/^###\s+(\d{4}-\d{2}-\d{2})\s+—/gm)]
  if (!matches.length) {
    throw new Error(`${filePath}: missing dated progress entries (### YYYY-MM-DD — ...)`)
  }
  return parseIsoDate(matches[0][1])
}

const failures = []

for (const filePath of DOCS_WITH_LAST_UPDATED) {
  try {
    const updatedAt = extractLastUpdated(filePath)
    const days = ageDays(updatedAt)
    if (days > MAX_AGE_DAYS) {
      failures.push(`${filePath} is stale (${days} days old, max ${MAX_AGE_DAYS}).`)
    }
  } catch (error) {
    failures.push(String(error.message ?? error))
  }
}

try {
  const latestProgressDate = extractLatestProgressEntryDate(PROGRESS_FILE)
  const progressAge = ageDays(latestProgressDate)
  if (progressAge > MAX_AGE_DAYS) {
    failures.push(`${PROGRESS_FILE} latest dated entry is stale (${progressAge} days old, max ${MAX_AGE_DAYS}).`)
  }
} catch (error) {
  failures.push(String(error.message ?? error))
}

if (failures.length) {
  console.error('Documentation freshness check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Documentation freshness check passed (threshold: ${MAX_AGE_DAYS} days).`)
