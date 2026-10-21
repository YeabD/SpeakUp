import fs from 'node:fs'
const base = process.env.ALIBI_PREVIEW_URL || 'http://localhost:3000'
const browser = process.env.ALIBI_BROWSER_URL || 'http://127.0.0.1:9229'
const liveTts = process.env.ALIBI_LIVE_TTS === '1'
// Test the built UI without creating a test account or changing application auth.
// The production practice URL correctly redirects unauthenticated navigation.
const builtDocument = process.env.ALIBI_BUILT_DOCUMENT === '1'
  ? fs.readFileSync(new URL('../.next/server/app/practice/alibi.html', import.meta.url)).toString('base64') : null
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let id = 0
const pending = new Map()
const exceptions = []
const networkErrors = []
socket.onmessage = ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.method === 'Fetch.requestPaused') {
    void send('Fetch.fulfillRequest', { requestId: msg.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: builtDocument }).catch(e => exceptions.push(e.message))
  }
  if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text)
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) networkErrors.push(`${msg.params.response.status} ${msg.params.response.url}`)
  const task = pending.get(msg.id)
  if (task) { pending.delete(msg.id); if (msg.error) task.reject(new Error(msg.error.message)); else task.resolve(msg.result) }
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id
    const timeout = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)) }, 25000)
    pending.set(key, { resolve: x => { clearTimeout(timeout); resolve(x) }, reject: e => { clearTimeout(timeout); reject(e) } })
    socket.send(JSON.stringify({ id: key, method, params }))
  })
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
async function ready(expression, timeout = 45000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { if (await evaluate(`!!document.body && (${expression})`)) return; await new Promise(r => setTimeout(r, 100)) }
  throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`)
}
async function click(text) {
  const expression = `([...document.querySelectorAll('button')].find(e => e.textContent.includes(${JSON.stringify(text)}) && !e.disabled))`
  await ready(`!!${expression}`)
  const point = await evaluate(`(() => { const e = ${expression}; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
}
function assert(value, message) { if (!value) throw new Error(message) }

// MediaRecorder, getUserMedia, Audio, Web Audio and timers are real. Native speech events
// use a deterministic fixture because headless CI machines may have no installed voices.
const fixture = `(() => {
  localStorage.setItem('speakup-theme', 'light');
  const original = window.fetch.bind(window);
  const c = { id: 'gallery', title: 'The Midnight Gallery', incident: 'A painting disappeared at an evening reception.', timeline: ['19:30 · Reception begins', '20:15 · Camera goes offline', '20:30 · Painting missing'], clues: ['A café receipt stamped 20:10', 'A blue umbrella', 'A message sent at 20:22'] };
  const questions = ['Where were you when the painting disappeared?', 'How does your café receipt fit that timeline?', 'Who can confirm your account?'];
  const answers = ['I was at the café at eight. I had a blue umbrella.', 'I kept my café receipt stamped 20:10 and sent a message at 20:22.', 'The waiter saw me leave.'];
  window.fixture = { attempt: null, failTts: false, failStt: false, failSave: false, failBrowserSpeech: false, blockPlay: false, pass: true, sttCalls: 0, evaluations: 0, questions: [], durations: [], activeStreams: 0, audioOverlap: false, questCredits: 0, audioPlaying: false, bufferPlaying: false, browserSpeaking: false, browserSpeechTexts: [], liveResponses: [] };
  const f = window.fixture;
  let speechTimer;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    resume() {}, getVoices() { return []; },
    cancel() { clearTimeout(speechTimer); f.browserSpeaking = false; },
    speak(u) { f.browserSpeechTexts.push(u.text); f.browserSpeaking = true; if(f.activeStreams) f.audioOverlap = true; u.onstart?.(new Event('start')); speechTimer=setTimeout(()=>{ f.browserSpeaking=false; if(f.failBrowserSpeech) { f.failBrowserSpeech=false; u.onerror?.({error:'not-allowed'}); } else u.onend?.(new Event('end')); },800); }
  } });
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (...args) => {
    if(f.audioPlaying || f.browserSpeaking || f.bufferPlaying) f.audioOverlap=true;
    const stream = await gum(...args); f.activeStreams++;
    stream.getTracks().forEach(track => { const stop = track.stop.bind(track); let stopped = false; track.stop = () => { if (!stopped) { f.activeStreams--; stopped = true; } stop(); }; });
    return stream;
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    if (f.activeStreams) f.audioOverlap = true;
    if(f.blockPlay) { f.blockPlay=false; return Promise.reject(new DOMException('Fixture autoplay rejection','NotAllowedError')); }
    f.audioPlaying=true;
    this.addEventListener('ended',()=>{f.audioPlaying=false;},{once:true});
    this.addEventListener('pause',()=>{f.audioPlaying=false;},{once:true});
    return play.call(this).catch(e=>{f.audioPlaying=false;throw e;});
  };
  const createSource=AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource=function() { const source=createSource.call(this); const start=source.start.bind(source), stop=source.stop.bind(source); source.start=(...args)=>{f.bufferPlaying=true;if(f.activeStreams)f.audioOverlap=true;return start(...args);}; source.stop=(...args)=>{f.bufferPlaying=false;return stop(...args);}; source.addEventListener('ended',()=>{f.bufferPlaying=false;});return source; };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === '/api/alibi') {
      if (!init?.body) return json({ attempt: f.attempt });
      const b = JSON.parse(init.body);
      if (b.action === 'start') {
        if (!f.attempt || f.attempt.evaluation) {
          const session = f.attempt?.evaluation?.is_passed ? f.attempt.session_number + 1 : f.attempt?.session_number || 1;
          f.attempt = { id: b.attempt_id, session_number: session, case_file: c, turns: [], question: null, evaluation: null, completed_sessions: session - 1 };
        }
      } else if (b.action === 'question') {
        f.attempt.question ||= questions[f.attempt.turns.length];
        if (!f.questions.includes(f.attempt.question)) f.questions.push(f.attempt.question);
      } else if (b.action === 'turn') {
        if (f.failSave) { f.failSave = false; return json({ error: 'Fixture save interruption' }, 503); }
        if (f.attempt.turns.length === b.index) { f.attempt.turns.push(b.turn); f.durations.push(b.turn.duration_ms); f.attempt.question = null; }
      }
      return json(f.attempt);
    }
    if (url === '/api/tts') {
      if (f.failTts) { f.failTts = false; return json({error:'Fixture TTS outage',fallback:'web-speech'},502); }
      if (${liveTts}) { const response=await original(input,init); f.liveResponses.push({text:JSON.parse(init.body).text,status:response.status,type:response.headers.get('Content-Type')}); return response; }
      const samples = 8000; const buffer = new ArrayBuffer(44 + samples * 2); const v = new DataView(buffer);
      const str = (o, t) => [...t].forEach((x, i) => v.setUint8(o + i, x.charCodeAt(0)));
      str(0, 'RIFF'); v.setUint32(4, buffer.byteLength - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples * 2, true);
      return new Response(buffer, { headers: { 'Content-Type': 'audio/wav' } });
    }
    if (url === '/api/stt') { f.sttCalls++; if (f.failStt) { f.failStt = false; return json({ error: 'Fixture recognition interruption' }, 502); } return json({ transcript: answers[f.attempt.turns.length], source: 'speechmatics' }); }
    if (url === '/api/sessions/evaluate') {
      f.evaluations++; if (!f.attempt.evaluation) {
        f.attempt.evaluation = { score: f.pass ? 85 : 64, is_passed: f.pass, criteria_scores: { grammar: 85, consistency: 85, evidence: 85, vocabulary: 85, relevance_fluency: 85 }, evidence_coverage: c.clues.map(clue => ({ clue, covered: true, turn: 1, quote: '', feedback: 'Incorporated.' })), consistency_findings: [], grammar_errors: [], vocabulary_upgrades: [], recognition_uncertainties: [], rephrased_ideal_sentence: 'I was at the café. The waiter saw me leave.', suggestions: ['Keep practising clear past-tense narration.'] };
        if (f.pass) f.questCredits++;
      }
      return json(f.attempt);
    }
    return original(input, init);
  };
})();`

try {
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  if (builtDocument) await send('Fetch.enable', { patterns: [{ urlPattern: `${base}/practice/alibi*`, resourceType: 'Document', requestStage: 'Request' }] })
  await send('Browser.grantPermissions', { origin: base, permissions: ['audioCapture'] })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fixture })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/practice/alibi` })
  await ready("document.body.innerText.includes('Open case briefing')")
  await click('Open case briefing')
  await ready("document.querySelectorAll('.alibi-clue').length === 3")
  const output = new URL('../.next/alibi-preview/', import.meta.url)
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(new URL('briefing-light.png', output), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'))
  for (const width of [320, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 })
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `Overflow at ${width}px`)
  }
  await evaluate("document.documentElement.classList.replace('light','dark')")
  fs.writeFileSync(new URL('briefing-dark.png', output), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'))
  await evaluate('fixture.failStt = true')
  if (!liveTts) await evaluate('fixture.failTts = true')
  await click('Start Interrogation')
  await ready(liveTts ? 'fixture.audioPlaying' : 'fixture.browserSpeaking')
  assert(await evaluate("fixture.activeStreams===0 && document.querySelector('[role=timer]').textContent.startsWith('25.0')"), 'Microphone or timer started during detective speech')
  await ready("document.body.innerText.includes('Submit answer early')")
  if (!liveTts) assert(await evaluate('fixture.browserSpeechTexts.length===1'), 'Provider failure did not use browser speech')
  await new Promise(r => setTimeout(r, 600))
  await click('Submit answer early')
  await ready("document.body.innerText.includes('Retry transcription')")
  assert(await evaluate('fixture.activeStreams === 0'), 'Microphone not released after stop')
  await click('Retry transcription')
  await ready("document.body.innerText.includes('Save & continue')")
  await evaluate('fixture.failSave = true')
  await click('Save & continue')
  await ready("document.body.innerText.includes('Fixture save interruption')")
  assert(await evaluate('fixture.attempt.turns.length === 0'), 'Failed save advanced the interview')
  if (!liveTts) await evaluate('fixture.blockPlay = true')
  await click('Save & continue')
  await ready("document.body.innerText.includes('Submit answer early')")
  const started = Date.now()
  await ready("document.body.innerText.includes('Save & continue')", 32000)
  assert(Date.now() - started >= 24000, 'Answer timed out too early')
  await click('Save & continue')
  if (!liveTts) {
    await ready('fixture.audioPlaying')
    await click('Stop playback')
    await ready("document.body.innerText.includes('Replay question')")
    assert(await evaluate('fixture.activeStreams===0'), 'Stop playback incorrectly started recording')
    await click('Replay question')
  }
  await ready("document.body.innerText.includes('Submit answer early')")
  await new Promise(r => setTimeout(r, 500))
  await click('Submit answer early')
  await ready("document.body.innerText.includes('Save & get verdict')")
  await click('Save & get verdict')
  await ready("document.body.innerText.includes('Your alibi holds.')")
  assert(await evaluate('fixture.questions.length === 3 && fixture.attempt.turns.length === 3'), 'Expected exactly three question-answer pairs')
  assert(await evaluate('fixture.durations.every(x => x <= 25000) && fixture.durations[1] === 25000'), '25-second deadline violated')
  assert(await evaluate('!fixture.audioOverlap && fixture.activeStreams === 0 && fixture.questCredits === 1'), 'Audio overlap, leaked stream, or incorrect fixture quest credit')
  if (liveTts) assert(await evaluate('fixture.questions.every(q=>fixture.liveResponses.some(r=>r.text===q && r.status===200 && r.type==="audio/wav")) && fixture.browserSpeechTexts.length===0'), 'Not all three questions received live Speechmatics WAV audio')
  fs.writeFileSync(new URL('verdict.png', output), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'))
  await click('Listen to natural English')
  await ready("document.body.innerText.includes('Listen to natural English')")
  await click('Next Session (2 of 15)')
  await ready("document.body.innerText.includes('Start Interrogation')")
  assert(await evaluate('fixture.attempt.session_number === 2'), 'Next session missing')
  if (!liveTts) {
    await evaluate('fixture.failTts=true;fixture.failBrowserSpeech=true')
    await click('Start Interrogation')
    await ready("document.body.innerText.includes('Submit answer early')")
    assert(await evaluate("document.body.innerText.includes('Voice playback is unavailable')"), 'Unavailable voices stranded the user or failed silently')
    await click('Submit answer early')
    await ready("document.body.innerText.includes('Save & continue')")
  }
  // Restore saved failure and session 15 fixtures through GET, exercising reload recovery.
  await evaluate('fixture.pass = false; fixture.attempt.evaluation = { score: 64, is_passed: false, criteria_scores: { grammar:64, consistency:64, evidence:64, vocabulary:64, relevance_fluency:64 }, evidence_coverage: fixture.attempt.case_file.clues.map(clue=>({clue,covered:false,turn:null,quote:"",feedback:"Try incorporating this clue."})), consistency_findings:[], grammar_errors:[], vocabulary_upgrades:[], recognition_uncertainties:[], rephrased_ideal_sentence:"I was at the café.", suggestions:["Keep a consistent timeline."] }; sessionStorage.setItem("alibi-restore", JSON.stringify(fixture.attempt))')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'if(sessionStorage.getItem("alibi-restore")) fixture.attempt = JSON.parse(sessionStorage.getItem("alibi-restore"));' })
  await send('Page.reload')
  await ready("document.body.innerText.includes('Retry Interrogation')")
  assert(await evaluate("![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Next Session'))"), 'Failure exposed progression')
  await evaluate('fixture.attempt.session_number=15; fixture.attempt.evaluation.is_passed=true; fixture.attempt.evaluation.score=85; sessionStorage.setItem("alibi-restore",JSON.stringify(fixture.attempt))')
  await send('Page.reload')
  await ready("document.body.innerText.includes('All 15 sessions completed')")
  assert(await evaluate("![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Next Session'))"), 'Session 15 offered session 16')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert(await evaluate("parseFloat(getComputedStyle(document.querySelector('.alibi-verdict')).animationDuration) <= .01"), 'Reduced motion not respected')
  assert(exceptions.length === 0, `Browser exceptions: ${exceptions.join(', ')}`)
  console.log('PASS: spoken briefing; three automatic speech-to-recording transitions; timer/mic locked during speech; STT/save retry; 25-second stop; pass/fail/final verdicts; reconstruction playback; responsive themes; no audio overlap or leaked tracks.')
  console.log(liveTts ? 'All three questions used live Speechmatics WAV audio. Alibi/STT/persistence use fixtures.' : 'Provider, browser speech, autoplay rejection, cancellation and unavailable-voice recovery use fixtures; recording and playback APIs are real.')
} catch (error) { console.error({ exceptions, networkErrors }); throw error }
finally { socket.close(); await fetch(`${browser}/json/close/${target.id}`) }
