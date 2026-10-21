import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const files = ['app/(auth)/login/page.tsx', 'app/(auth)/signup/page.tsx', 'app/onboarding/language/page.tsx', 'app/dashboard/page.tsx', 'app/practice/shadowing/page.tsx', 'app/practice/ping-pong/page.tsx', 'app/practice/compressor/page.tsx', 'components/modules/CircumlocutionSprint.tsx', 'components/modules/EchoShadowingStudio.tsx', 'components/modules/SessionRunner.tsx']
const printer = ts.createPrinter({ removeComments: true })
const criticalCalls = new Set(['useState', 'useReducer', 'useEffect', 'fetch', 'setInterval', 'setTimeout', 'router.push', 'router.replace'])
function contracts(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const calls = []
  function visit(node) {
    if (ts.isCallExpression(node) && criticalCalls.has(node.expression.getText(ast))) {
      calls.push(printer.printNode(ts.EmitHint.Unspecified, node, ast))
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return calls
}
let failed = false
for (const filename of files) {
  const previous = contracts(execFileSync('git', ['show', `HEAD:${filename}`], { encoding: 'utf8' }), filename)
  const current = contracts(fs.readFileSync(filename, 'utf8'), filename)
  if (JSON.stringify(previous) !== JSON.stringify(current)) {
    console.error(`${filename}: review required — a state/effect/request/timer/navigation call changed.`)
    failed = true
  } else console.log(`${filename}: existing state, effects, requests, timers, and navigation preserved.`)
}
const backendDiff = execFileSync('git', ['diff', '--name-only', '--', 'app/api', 'src/middleware.ts', 'src/lib/supabase'], { encoding: 'utf8' }).trim()
if (backendDiff) { console.error(`Backend files changed: ${backendDiff}`); failed = true }
if (failed) process.exitCode = 1
else console.log('UI migration preservation audit passed; backend files are unchanged.')
