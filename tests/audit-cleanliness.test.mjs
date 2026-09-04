import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'src')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css'])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (sourceExtensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

async function resolvesRelativeImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    ...[...sourceExtensions].map(extension => `${base}${extension}`),
    ...[...sourceExtensions].map(extension => join(base, `index${extension}`)),
  ]
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return true
    } catch {}
  }
  return false
}

const files = await walk(srcRoot)
const sources = new Map(await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')])))

test('every relative source import resolves to an existing file', async () => {
  const unresolved = []
  const importPattern = /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g
  for (const [file, source] of sources) {
    for (const match of source.matchAll(importPattern)) {
      if (!await resolvesRelativeImport(file, match[1])) unresolved.push(`${file.slice(root.length + 1)} -> ${match[1]}`)
    }
  }
  assert.deepEqual(unresolved, [])
})

test('active source has no debugging leftovers or unfinished TODO markers', () => {
  const findings = []
  for (const [file, source] of sources) {
    if (/\bdebugger\b/.test(source)) findings.push(`${file.slice(root.length + 1)}: debugger`)
    if (/\bconsole\.log\s*\(/.test(source)) findings.push(`${file.slice(root.length + 1)}: console.log`)
    if (/\b(?:TODO|FIXME)\b/i.test(source)) findings.push(`${file.slice(root.length + 1)}: TODO/FIXME`)
  }
  assert.deepEqual(findings, [])
})

test('removed workspace and permission generations are not referenced by active source', () => {
  const combined = [...sources.values()].join('\n')
  for (const obsolete of [
    'MatrixWorkspaceV3', 'MatrixWorkspaceV4', 'MatrixWorkspaceV5', 'MatrixWorkspaceV8', 'MatrixWorkspaceV14',
    'PermissionCatalogV2', 'PermissionCatalogV3', 'GuidelineCatalog', 'GuidelineDocumentImport', 'GuidelineGrid',
  ]) {
    assert.doesNotMatch(combined, new RegExp(`['\"]\\./${obsolete}['\"]`))
  }
})
