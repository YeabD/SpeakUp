import assert from 'node:assert/strict'
const base = process.env.ALIBI_PREVIEW_URL || 'http://localhost:3000'
const response = await fetch(`${base}/api/tts`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Testing detective audio.' }), signal: AbortSignal.timeout(30000),
})
if (!response.ok) {
  const result = await response.json()
  console.error(`Live TTS returned HTTP ${response.status}: ${result.code ?? result.error}. Browser fallback will be used.`)
  process.exitCode = 1
} else {
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.equal(response.headers.get('content-type'), 'audio/wav')
  assert.equal(Number(response.headers.get('content-length')), bytes.byteLength)
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF')
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE')
  assert.ok(bytes.length > 44 && bytes.slice(44).some(byte => byte !== 0), 'WAV contains no audio samples')
  console.log(`PASS: live Speechmatics TTS returned ${bytes.byteLength} WAV bytes with audio samples and correct headers.`)
}
