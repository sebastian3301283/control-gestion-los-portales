import fs from 'node:fs'

const path = 'src/Dashboard.tsx'
const source = fs.readFileSync(path, 'utf8')
const from = "    const preferred = (initialYear ? available.find(item => item.year === initialYear) : null) || available.find(item => item.status === 'OPEN') || available[0] || null"
const to = "    const currentYear = new Date().getFullYear()\n    const preferred = (initialYear ? available.find(item => item.year === initialYear) : available.find(item => item.year === currentYear)) || available.find(item => item.status === 'OPEN') || available[0] || null"

if (!source.includes(from)) throw new Error('Expected PlanningView period selection was not found')
fs.writeFileSync(path, source.replace(from, to))
console.log('Applied current-year default to direct Planning navigation')
