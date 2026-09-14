import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'src')
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css']

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (sourceExtensions.includes(extname(entry.name))) files.push(path)
  }
  return files
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

async function resolveRelativeImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = extname(base)
    ? [base]
    : [base, ...sourceExtensions.map(extension => `${base}${extension}`), ...sourceExtensions.map(extension => join(base, `index${extension}`))]
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate
    } catch {}
  }
  return null
}

function relativeSpecifiers(source) {
  const found = new Set()
  const patterns = [
    /\bfrom\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\()?\s*['"](\.[^'"]+)['"]/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1])
  }
  return [...found]
}

async function buildRuntimeReachability() {
  const files = await walk(srcRoot)
  const fileSet = new Set(files)
  const reachable = new Set()
  const pending = [join(srcRoot, 'main.tsx')]

  while (pending.length) {
    const file = pending.pop()
    if (!file || reachable.has(file) || !fileSet.has(file)) continue
    reachable.add(file)
    const source = await readFile(file, 'utf8')
    for (const specifier of relativeSpecifiers(source)) {
      const target = await resolveRelativeImport(file, specifier)
      if (target && !reachable.has(target)) pending.push(target)
    }
  }

  return { files, reachable }
}

test('todos los módulos runtime de src son alcanzables desde main.tsx', async () => {
  const { files, reachable } = await buildRuntimeReachability()
  const unreachable = files
    .filter(file => !file.endsWith('.d.ts'))
    .filter(file => !reachable.has(file))
    .map(file => file.slice(srcRoot.length + 1).replaceAll('\\', '/'))
    .sort()
  assert.deepEqual(unreachable, [])
})

test('las generaciones retirables solo se eliminan después de demostrar que no son runtime', async () => {
  const { reachable } = await buildRuntimeReachability()
  const candidates = [
    'MatrixWorkspaceV10.tsx',
    'central-excel-model.js',
    'central-table-rows.js',
    'matrix-subpoints.js',
  ]
  const existing = []
  for (const candidate of candidates) {
    const path = join(srcRoot, candidate)
    if (!await exists(path)) continue
    existing.push(candidate)
    assert.equal(reachable.has(path), false, `${candidate} todavía participa del runtime y no se debe borrar`)
  }
  assert.deepEqual(existing, [], `Quedan generaciones/helpers muertos por retirar: ${existing.join(', ')}`)
})
