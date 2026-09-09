import { readFile, writeFile } from 'node:fs/promises'

const path = 'src/planning-guidelines.css'
const needle = '@media(max-width:800px){.planning-module-choice-grid{grid-template-columns:1fr}.planning-guidelines-heading'
const replacement = '@media(max-width:800px){.planning-guidelines-heading'

let css = await readFile(path, 'utf8')
if (!css.includes(needle)) throw new Error('Expected leftover responsive planning-module rule not found')
css = css.replace(needle, replacement)
await writeFile(path, css)
