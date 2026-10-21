import fs from 'node:fs'

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const parse = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]))
const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
const luminance = (color) => color.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
const ratio = (left, right) => (Math.max(luminance(left), luminance(right)) + .05) / (Math.min(luminance(left), luminance(right)) + .05)
let failed = false
for (const [theme, selector] of [['Light', ':root'], ['Dark', '.dark']]) {
  const start = css.indexOf(`${selector} {`)
  const tokens = parse(css.slice(start, css.indexOf('}', start)))
  const pairs = [['foreground', 'background'], ['card-foreground', 'card'], ['muted-foreground', 'background'], ['muted-foreground', 'card'], ['muted-foreground', 'muted'], ['primary-foreground', 'primary'], ['secondary-foreground', 'secondary'], ['accent-foreground', 'accent'], ['success-foreground', 'success'], ['warning-foreground', 'warning'], ['destructive-foreground', 'destructive']]
  for (const tone of ['primary', 'ai', 'success', 'warning', 'coral', 'info', 'destructive']) {
    pairs.push([tone, 'card'])
    const tint = rgb(tokens.card).map((channel, index) => channel * .9 + rgb(tokens[tone])[index] * .1)
    const result = ratio(rgb(tokens[tone]), tint)
    if (result < 4.5) { console.error(`${theme}: ${tone} on 10% tinted card: ${result.toFixed(2)}:1 FAIL`); failed = true }
  }
  for (const [foreground, background] of pairs) {
    const result = ratio(rgb(tokens[foreground]), rgb(tokens[background]))
    if (result < 4.5) { console.error(`${theme}: ${foreground} on ${background}: ${result.toFixed(2)}:1 FAIL`); failed = true }
  }
  for (const surface of ['card', 'background']) {
    const result = ratio(rgb(tokens.input), rgb(tokens[surface]))
    if (result < 3) { console.error(`${theme}: input boundary on ${surface}: ${result.toFixed(2)}:1 FAIL`); failed = true }
  }
  console.log(`${theme}: checked ${pairs.length} text pairs, 7 tinted text pairs, and 2 control boundaries.`)
}
if (failed) process.exitCode = 1
else console.log('All checked design token pairs meet WCAG AA contrast thresholds.')
