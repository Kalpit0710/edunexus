const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const rootDir = process.cwd()
const docsDir = path.join(rootDir, 'Documentation')
const outputFile = path.join(docsDir, 'AI_CONTEXT_SNAPSHOT.md')

const IGNORE_DIRS = new Set(['.git', '.next', 'node_modules', 'playwright-report', 'test-results'])

function safeExec(command) {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function safeExecRaw(command) {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  } catch {
    return ''
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath))
}

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

function countFiles(startPath, matcher) {
  if (!fs.existsSync(startPath)) {
    return 0
  }

  let count = 0
  const stack = [startPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        if (entry.name !== '.github') {
          continue
        }
      }

      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          stack.push(absolutePath)
        }
        continue
      }

      if (matcher(absolutePath, entry.name)) {
        count += 1
      }
    }
  }

  return count
}

function listDirectories(relativePath) {
  const absolutePath = path.join(rootDir, relativePath)
  if (!fs.existsSync(absolutePath)) {
    return []
  }

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function listModuleDirectories() {
  const candidates = ['src/components/modules', 'src/app/components/modules']
  const paths = new Set()

  for (const candidate of candidates) {
    const names = listDirectories(candidate)
    for (const name of names) {
      paths.add(toPosixPath(path.join(candidate, name)))
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b))
}

function listMarkdownFiles(relativePath) {
  const absolutePath = path.join(rootDir, relativePath)
  if (!fs.existsSync(absolutePath)) {
    return []
  }

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function firstHeading(markdownText) {
  const match = markdownText.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled'
}

function extractCurrentPhase(progressText) {
  const match = progressText.match(/^##\s+Current Phase:\s*(.+)$/m)
  return match ? match[1].trim() : 'Unknown'
}

function extractOverallProgress(progressText) {
  const match = progressText.match(/^\*\*Overall Phase 1 Progress:\*\*\s*(.+)$/m)
  return match ? match[1].trim() : 'Unknown'
}

function extractMilestones(progressText) {
  const lines = progressText.split(/\r?\n/)
  const startIndex = lines.findIndex((line) => line.includes('| Milestone | Status | Notes |'))
  if (startIndex === -1) {
    return []
  }

  const rows = []
  for (let i = startIndex + 2; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) {
      break
    }

    const columns = line
      .split('|')
      .slice(1, -1)
      .map((value) => value.trim())

    if (columns.length >= 2 && columns[0] !== 'Milestone' && columns[0] !== '---') {
      rows.push({
        milestone: columns[0],
        status: columns[1],
        notes: columns[2] || 'No notes',
      })
    }
  }

  return rows
}

function extractPhaseHeadings(planText) {
  const headings = []
  const regex = /^##\s+(Phase\s+\d+\s+.+)$/gm
  let match = regex.exec(planText)
  while (match) {
    headings.push(match[1].trim())
    match = regex.exec(planText)
  }
  return headings
}

function getGitStatus() {
  const branch = safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const latestCommit =
    safeExec('git log -1 --pretty=format:%h %ad %s --date=short') || 'No commits found'
  const statusRaw = safeExecRaw('git status --porcelain')
  const changedFiles = statusRaw
    ? statusRaw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^[ MADRCU?!]{1,2}\s+(.*)$/)
          return (match ? match[1] : line).trim()
        })
    : []

  return {
    branch,
    latestCommit,
    changedFiles,
  }
}

function formatCommandList(scripts) {
  const preferredOrder = [
    'dev',
    'build',
    'start',
    'lint',
    'lint:fix',
    'format',
    'format:check',
    'type-check',
    'test',
    'test:watch',
    'test:coverage',
    'test:e2e',
    'test:e2e:ui',
    'db:types',
    'db:push',
    'db:reset',
    'db:link',
    'db:setup',
    'supabase:login',
    'ai:sync-context',
  ]

  const ordered = []
  for (const name of preferredOrder) {
    if (scripts[name]) {
      ordered.push({ name, command: scripts[name] })
    }
  }

  const remaining = Object.keys(scripts)
    .filter((name) => !preferredOrder.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, command: scripts[name] }))

  return [...ordered, ...remaining]
}

function main() {
  const packageJsonText = readText('package.json')
  const packageJson = packageJsonText ? JSON.parse(packageJsonText) : {}
  const scripts = packageJson.scripts || {}

  const aiGuideText = readText('Documentation/AI_COLLABORATION_GUIDE.md')
  const progressText = readText('Documentation/PROGRESS.md')
  const developmentPlanText = readText('Documentation/DEVELOPMENT_PLAN.md')
  const architectureText = readText('Documentation/ARCHITECTURE.md')

  const sourceFileCount = countFiles(path.join(rootDir, 'src'), (absolutePath) =>
    absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx')
  )
  const unitTestCount = countFiles(path.join(rootDir, 'tests', 'unit'), (_, name) =>
    name.endsWith('.test.ts') || name.endsWith('.test.tsx')
  )
  const integrationTestCount = countFiles(
    path.join(rootDir, 'tests', 'integration'),
    (_, name) => name.endsWith('.test.ts') || name.endsWith('.test.tsx')
  )
  const e2eTestCount = countFiles(path.join(rootDir, 'tests', 'e2e'), (_, name) =>
    name.endsWith('.spec.ts') || name.endsWith('.spec.tsx')
  )
  const migrationCount = countFiles(path.join(rootDir, 'supabase', 'migrations'), (_, name) =>
    name.endsWith('.sql')
  )

  const moduleDirectories = listModuleDirectories()
  const edgeFunctions = listDirectories('supabase/functions')
  const docs = listMarkdownFiles('Documentation')
  const git = getGitStatus()

  const milestones = extractMilestones(progressText)
  const currentPhase = extractCurrentPhase(progressText)
  const overallProgress = extractOverallProgress(progressText)
  const phaseHeadings = extractPhaseHeadings(developmentPlanText)
  const commands = formatCommandList(scripts)

  const keyDocs = [
    'Documentation/AI_COLLABORATION_GUIDE.md',
    'Documentation/PROGRESS.md',
    'Documentation/DEVELOPMENT_PLAN.md',
    'Documentation/ARCHITECTURE.md',
    'Documentation/TESTING_STRATEGY.md',
    'Documentation/API_DESIGN.md',
    'Documentation/SECURITY.md',
    'Documentation/DATABASE_SCHEMA.md',
    'Documentation/UI_UX_GUIDELINES.md',
    'Documentation/CONTRIBUTING.md',
  ]

  const generatedAt = new Date().toISOString()

  const lines = []
  lines.push('# AI Context Snapshot')
  lines.push('')
  lines.push('> This file is auto-generated by `scripts/sync-ai-context.js`.')
  lines.push(`> Generated at: ${generatedAt}`)
  lines.push(`> Current branch: ${git.branch}`)
  lines.push(`> Latest commit: ${git.latestCommit}`)
  lines.push('')
  lines.push('## Current Status Summary')
  lines.push('')
  lines.push(`- Current phase: ${currentPhase}`)
  lines.push(`- Overall progress note: ${overallProgress}`)
  lines.push(`- AI guide heading: ${firstHeading(aiGuideText)}`)
  lines.push(`- Architecture heading: ${firstHeading(architectureText)}`)
  lines.push('')

  lines.push('## Milestone Snapshot')
  lines.push('')
  if (milestones.length === 0) {
    lines.push('- No milestone table found in `Documentation/PROGRESS.md`.')
  } else {
    for (const row of milestones.slice(0, 20)) {
      lines.push(`- ${row.milestone}: ${row.status} (${row.notes})`)
    }
  }
  lines.push('')

  lines.push('## Codebase Footprint')
  lines.push('')
  lines.push(`- Source files (.ts/.tsx under src): ${sourceFileCount}`)
  lines.push(`- Unit tests: ${unitTestCount}`)
  lines.push(`- Integration tests: ${integrationTestCount}`)
  lines.push(`- E2E tests: ${e2eTestCount}`)
  lines.push(`- Supabase migrations: ${migrationCount}`)
  lines.push(`- Module directories: ${moduleDirectories.length}`)
  lines.push(`- Edge functions: ${edgeFunctions.length}`)
  lines.push('')

  lines.push('### Module Directories')
  lines.push('')
  if (moduleDirectories.length === 0) {
    lines.push('- None found in `src/components/modules`.')
  } else {
    for (const name of moduleDirectories) {
      lines.push(`- ${name}`)
    }
  }
  lines.push('')

  lines.push('### Supabase Edge Functions')
  lines.push('')
  if (edgeFunctions.length === 0) {
    lines.push('- None found in `supabase/functions`.')
  } else {
    for (const name of edgeFunctions) {
      lines.push(`- ${name}`)
    }
  }
  lines.push('')

  lines.push('## Roadmap Headings')
  lines.push('')
  if (phaseHeadings.length === 0) {
    lines.push('- No phase headings detected in `Documentation/DEVELOPMENT_PLAN.md`.')
  } else {
    for (const heading of phaseHeadings) {
      lines.push(`- ${heading}`)
    }
  }
  lines.push('')

  lines.push('## Canonical Commands from package.json')
  lines.push('')
  if (commands.length === 0) {
    lines.push('- No scripts found in `package.json`.')
  } else {
    for (const item of commands) {
      lines.push(`- pnpm ${item.name}: ${item.command}`)
    }
  }
  lines.push('')

  lines.push('## Documentation Coverage')
  lines.push('')
  lines.push(`- Markdown docs found in Documentation/: ${docs.length}`)
  for (const doc of docs) {
    lines.push(`- Documentation/${doc}`)
  }
  lines.push('')

  lines.push('### Key Docs (Priority Read Order)')
  lines.push('')
  for (const docPath of keyDocs) {
    if (exists(docPath)) {
      lines.push(`- ${docPath}`)
    }
  }
  lines.push('')

  lines.push('## Working Tree Changes')
  lines.push('')
  if (git.changedFiles.length === 0) {
    lines.push('- Working tree clean at generation time.')
  } else {
    lines.push(`- Modified/untracked files: ${git.changedFiles.length}`)
    for (const relativePath of git.changedFiles.slice(0, 50)) {
      lines.push(`- ${toPosixPath(relativePath)}`)
    }
  }
  lines.push('')

  lines.push('## Context Refresh Protocol')
  lines.push('')
  lines.push('- Regenerate this file after meaningful code, schema, test, or doc updates.')
  lines.push('- Command: `pnpm ai:sync-context`')
  lines.push('- If package scripts are unavailable, run `node scripts/sync-ai-context.js`.')
  lines.push('')

  fs.writeFileSync(outputFile, `${lines.join('\n')}\n`, 'utf8')
  process.stdout.write(`Updated ${toPosixPath(path.relative(rootDir, outputFile))}\n`)
}

main()
