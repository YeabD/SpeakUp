import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import ts from 'typescript'

function load(file) {
  const filename = path.resolve(file)
  const mod = new Module(filename)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename)
  return mod.exports
}
const { POST } = load('app/api/tts/route.ts')
const { DetectiveSpeech } = load('src/lib/alibi/speech.ts')
const originalFetch = globalThis.fetch
const originalKey = process.env.SPEECHMATICS_API_KEY
const originals = Object.fromEntries(['window', 'Audio', 'AudioContext', 'SpeechSynthesisUtterance'].map(key => [key, globalThis[key]]))
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.SPEECHMATICS_API_KEY; else process.env.SPEECHMATICS_API_KEY = originalKey
  for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value }
})
function wav() {
  const bytes = new Uint8Array(48)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  bytes.set(new TextEncoder().encode('WAVE'), 8)
  return bytes
}
const request = (body = { text: 'Testing detective audio.' }) => new Request('http://localhost/api/tts', { method: 'POST', body: JSON.stringify(body) })
const flush = () => new Promise(resolve => setImmediate(resolve))
function browser({ blocked = false, native = true } = {}) {
  const state = { player: null, utterance: null, cancelled: 0, source: null, resumed: false, loaded: false }
  globalThis.Audio = class {
    constructor() { state.player = this }
    play() { return blocked ? Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')) : Promise.resolve() }
    pause() { this.paused = true }
    removeAttribute() {}
    load() { state.loaded = true }
  }
  globalThis.AudioContext = class {
    state = 'suspended'
    destination = {}
    resume() { state.resumed = true; this.state = 'running'; return Promise.resolve() }
    close() { this.state = 'closed'; return Promise.resolve() }
    decodeAudioData() { return Promise.resolve({}) }
    createBufferSource() {
      state.source = { connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true } }
      return state.source
    }
  }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  globalThis.window = native ? { SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance, speechSynthesis: {
    getVoices: () => [], resume() {}, cancel() { state.cancelled++ }, speak(u) { state.utterance = u },
  } } : {}
  return state
}
test('missing key is an explicit HTTP 500 with structured browser fallback', async () => {
  delete process.env.SPEECHMATICS_API_KEY
  const response = await POST(request())
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Missing SPEECHMATICS_API_KEY', code: 'missing-api-key', fallback: 'web-speech' })
})
test('Speechmatics uses Bearer auth and returns WAV bytes with exact length', async () => {
  process.env.SPEECHMATICS_API_KEY = ' test-only-key '
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://preview.tts.speechmatics.com/generate/sarah?output_format=wav_16000')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.Authorization, 'Bearer test-only-key')
    assert.deepEqual(JSON.parse(init.body), { text: 'Testing detective audio.' })
    return new Response(wav())
  }
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'audio/wav')
  assert.equal(response.headers.get('content-length'), '48')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), wav())
})
test('upstream 4xx/5xx and invalid audio return structured fallback, never a success tone', async () => {
  process.env.SPEECHMATICS_API_KEY = 'test-only-key'
  for (const status of [401, 429, 500]) {
    globalThis.fetch = async () => new Response('Failure', { status })
    const response = await POST(request())
    assert.equal(response.status, 502)
    assert.equal((await response.json()).code, `upstream-${status}`)
  }
  globalThis.fetch = async () => new Response(new Uint8Array(100))
  assert.equal((await (await POST(request())).json()).code, 'invalid-audio')
})
test('network failures produce fallback and malformed input is rejected', async () => {
  process.env.SPEECHMATICS_API_KEY = 'test-only-key'
  globalThis.fetch = async () => { throw new TypeError('Network unavailable') }
  assert.equal((await (await POST(request())).json()).code, 'network-error')
  assert.equal((await POST(request({ text: '' }))).status, 400)
  assert.equal((await POST(request(null))).status, 400)
})
test('upstream timeout is bounded and explicitly reported', async t => {
  process.env.SPEECHMATICS_API_KEY = 'test-only-key'
  t.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
    const pending = POST(request())
    await flush()
    t.mock.timers.tick(15001)
    const response = await pending
    assert.equal(response.status, 504)
    assert.equal((await response.json()).code, 'timeout')
  } finally { t.mock.timers.reset() }
})
test('successful playback finishes only on ended, and releases audio resources', async () => {
  const state = browser()
  globalThis.fetch = async () => new Response(wav(), { headers: { 'Content-Type': 'audio/wav' } })
  const speech = new DetectiveSpeech()
  let ended = false
  const pending = speech.speak('Where were you?', new AbortController().signal, () => assert.fail('Unexpected fallback')).then(() => { ended = true })
  await flush()
  assert.equal(ended, false)
  state.player.onended()
  await pending
  assert.equal(ended, true)
  assert.equal(state.player.paused, true)
  assert.equal(state.loaded, true)
})
test('failed Speechmatics uses browser speech and waits for its onend', async () => {
  const state = browser()
  globalThis.fetch = async () => new Response('{}', { status: 502 })
  const speech = new DetectiveSpeech()
  let ended = false
  const pending = speech.speak('Where were you?', new AbortController().signal, () => {}).then(() => { ended = true })
  await flush()
  assert.equal(state.utterance.text, 'Where were you?')
  assert.equal(state.utterance.lang, 'en-GB')
  assert.equal(ended, false)
  state.utterance.onend()
  await pending
  assert.equal(ended, true)
})
test('autoplay rejection uses the AudioContext unlocked during the initiating click', async () => {
  const state = browser({ blocked: true })
  globalThis.fetch = async () => new Response(wav(), { headers: { 'Content-Type': 'audio/wav' } })
  const speech = new DetectiveSpeech()
  speech.unlock()
  assert.equal(state.resumed, true)
  const pending = speech.speak('Question?', new AbortController().signal, () => assert.fail('Unexpected browser fallback'))
  await flush()
  assert.ok(state.source)
  state.source.onended()
  await pending
  assert.equal(state.source.stopped, true)
  speech.dispose()
})
test('blocked media without unlocked Web Audio still tries native speech', async () => {
  const state = browser({ blocked: true })
  globalThis.fetch = async () => new Response(wav(), { headers: { 'Content-Type': 'audio/wav' } })
  const pending = new DetectiveSpeech().speak('Question?', new AbortController().signal, () => {})
  await flush()
  assert.equal(state.utterance.text, 'Question?')
  state.utterance.onend()
  await pending
})
test('stop cancels native speech without falling through to a recording-ready completion', async () => {
  const state = browser()
  globalThis.fetch = async () => new Response('{}', { status: 502 })
  const speech = new DetectiveSpeech()
  const pending = speech.speak('Question?', new AbortController().signal, () => {})
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  await flush()
  speech.stop()
  await rejected
  assert.equal(state.utterance.onend, null)
  assert.ok(state.cancelled >= 2)
})
test('unavailable native speech surfaces an error for the nonblocking UI recovery', async () => {
  browser({ native: false })
  globalThis.fetch = async () => { throw new TypeError('Offline') }
  await assert.rejects(new DetectiveSpeech().speak('Question?', new AbortController().signal, () => {}), /Browser speech is unavailable/)
})
