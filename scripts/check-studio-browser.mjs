// Browser smoke checks using the local Chromium debugging protocol; no test dependency required.
import fs from 'node:fs'

const base = process.env.STUDIO_PREVIEW_URL || 'http://127.0.0.1:3011'
const browser = process.env.STUDIO_BROWSER_URL || 'http://127.0.0.1:9228'
const target = await (await fetch(`${browser}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
const pending = new Map()
const exceptions = []
let id = 0
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
  const callback = pending.get(message.id)
  if (callback) {
    pending.delete(message.id)
    if (message.error) callback.reject(new Error(message.error.message))
    else callback.resolve(message.result)
  }
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    const requestId = ++id
    pending.set(requestId, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
async function ready(condition) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (await evaluate(condition)) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Browser condition timed out: ${condition}`)
}
async function click(expression) {
  const point = await evaluate(`(() => { const e = ${expression}; e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
}
function assert(value, message) { if (!value) throw new Error(message) }

try {
  await send('Page.enable')
  await send('Runtime.enable')
  const themeSeed = await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('speakup-theme', 'light')" })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: base })
  await ready("document.readyState === 'complete' && document.title === 'SpeakUp' && !!document.querySelector('h1')")
  await evaluate('document.fonts.ready')
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: themeSeed.identifier })
  assert(await evaluate("document.documentElement.classList.contains('light')"), `Light theme was not applied: ${await evaluate("JSON.stringify({url: location.href, title: document.title, classes: document.documentElement.className, stored: localStorage.getItem('speakup-theme'), scripts: document.scripts.length})")}`)
  assert(await evaluate("getComputedStyle(document.querySelector('h1')).fontFamily.includes('localFont') || getComputedStyle(document.querySelector('h1')).fontFamily.includes('Outfit') || document.fonts.size >= 2"), 'Local font faces were not registered.')
  const output = new URL('../.next/ui-preview/', import.meta.url)
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(new URL('home-light.png', output), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'))

  await ready("!!document.querySelector('[aria-label=\"Choose color theme\"]')")
  await click("document.querySelector('[aria-label=\"Choose color theme\"]')")
  await ready("document.querySelectorAll('[role=\"menuitemradio\"]').length === 3")
  await click("[...document.querySelectorAll('[role=\"menuitemradio\"]')].find(e => e.textContent.includes('Dark'))")
  await ready("document.documentElement.classList.contains('dark')")
  assert(await evaluate("localStorage.getItem('speakup-theme') === 'dark'"), 'The selected theme was not persisted.')
  await send('Page.reload')
  await ready("document.readyState === 'complete' && !!document.querySelector('h1') && document.documentElement.classList.contains('dark')")
  fs.writeFileSync(new URL('home-dark.png', output), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'))
  console.log('Desktop: both themes render; theme menu works and persists the selection.')

  for (const width of [320, 360, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 })
    for (const path of ['/', '/login', '/signup']) {
    await send('Page.navigate', { url: `${base}${path}` })
    await ready("document.readyState === 'complete' && !!document.querySelector('h1')")
    await evaluate('document.fonts.ready')
    assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `Horizontal overflow at ${width}px on ${path}`)
    if (path !== '/') {
      assert(await evaluate("[...document.querySelectorAll('input')].every(e => !!document.querySelector('label[for=\"' + e.id + '\"]'))"), `Missing form labels on ${path}`)
      await evaluate("document.querySelector('input[type=email]').focus()")
      await send('Input.insertText', { text: 'preview@example.com' })
    }
    console.log(`${path}: ${width}px layout fits; ${path === '/' ? 'landing content' : 'associated form labels'} verified.`)
    }
  }
  await click("document.querySelector('[aria-label=\"Choose color theme\"]')")
  await ready("document.querySelectorAll('[role=\"menuitemradio\"]').length === 3")
  await click("[...document.querySelectorAll('[role=\"menuitemradio\"]')].find(e => e.textContent.includes('Light'))")
  await ready("document.documentElement.classList.contains('light')")
  assert(await evaluate("document.querySelector('input[type=email]').value === 'preview@example.com'"), 'A theme change reset the form state.')
  console.log('Theme change preserved the controlled form state.')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert(await evaluate("getComputedStyle(document.querySelector('button')).transitionDuration.split(',').every(t => parseFloat(t) <= .01)"), 'Reduced motion was not applied.')
  assert(exceptions.length === 0, `Uncaught browser errors: ${exceptions.join(', ')}`)
  console.log('Reduced motion respected; no uncaught browser exceptions. Screenshots: .next/ui-preview/')
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`).catch(() => {})
}
