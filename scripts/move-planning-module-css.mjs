import { readFile, writeFile } from 'node:fs/promises'

const basePath = 'src/planning.css'
const lazyPath = 'src/planning-guidelines.css'

const criticalCss = `.planning-module-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.planning-module-choice{display:flex;align-items:center;gap:16px;min-height:128px;padding:22px;border:1px solid #dbe5ed;border-radius:16px;background:#fff;text-align:left;cursor:pointer;transition:.18s ease}.planning-module-choice:hover{transform:translateY(-1px);border-color:#a9c4d8;box-shadow:0 10px 24px rgba(33,74,105,.08)}.planning-module-choice__icon{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;border-radius:12px;background:#edf6fc;color:#176fb3}.planning-module-choice__copy{display:grid;gap:3px;min-width:0}.planning-module-choice__copy small{color:#7c8f9e;font-size:11px;font-weight:700}.planning-module-choice__copy strong{color:#173750;font-size:20px}.planning-module-choice__copy p{margin:0;color:#748897;font-size:12px;line-height:1.45}.planning-module-choice>svg{margin-left:auto;color:#52758e}.planning-module-choice--guidelines .planning-module-choice__icon{background:#fff5df;color:#d98716}.planning-module-choice--matrices .planning-module-choice__icon{background:#eaf6ef;color:#2f9b5f}`

let base = await readFile(basePath, 'utf8')
let lazy = await readFile(lazyPath, 'utf8')

if (!lazy.includes(criticalCss)) throw new Error('Expected planning module CSS block was not found in lazy stylesheet')
if (base.includes('.planning-module-choice-grid{')) throw new Error('Critical planning module CSS is already present in base stylesheet')

lazy = lazy.replace(criticalCss, '')
base = `${base.trimEnd()}\n${criticalCss}\n@media(max-width:800px){.planning-module-choice-grid{grid-template-columns:1fr}}\n`

await writeFile(basePath, base)
await writeFile(lazyPath, lazy)
