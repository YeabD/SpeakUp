# Alibi Interrogation

The module lives at `/practice/alibi` and appears on the dashboard. It uses the existing Supabase cookie authentication, Gemini model, `/api/tts` Speechmatics synthesis, `/api/stt` transcription, shared UI components, and theme tokens.

## Setup

1. Apply `supabase/migrations/202610200001_alibi.sql` to the application's Supabase database using the normal migration process. The existing `daily_quests`, `module_progress`, and `level_sessions` tables must already exist as described in `src/lib/supabase/database.types.ts`.
2. Configure server environment variables `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), and `SPEECHMATICS_API_KEY`, plus the existing public Supabase URL and anonymous key. Never prefix service credentials with `NEXT_PUBLIC_`.
3. Use HTTPS (localhost also works) in a browser supporting MediaRecorder, Web Audio, and microphone access.

The shared TTS endpoint returns actual Speechmatics WAV bytes on success. Missing credentials return HTTP 500; provider failures and timeouts return structured JSON with `fallback: "web-speech"` and HTTP 502/504. It never returns a generated tone as successful speech. Alibi automatically tries the installed browser voice if synthesis or playback fails. If both voice backends are unavailable, it displays a notice and allows the response to proceed using the visible question.

## Persistence and API contracts

- `GET /api/alibi`: restores the latest attempt, including saved failed feedback. A partially completed interview resumes without changing its case or clues.
- `POST /api/alibi`: `start` accepts a UUID idempotency key; returns an existing unfinished attempt or creates the next eligible session. `question` retrieves/generates one question for the current turn. `turn` saves a validated answer at its expected zero-based index, exactly once. All operations use the authenticated user, never a supplied user ID.
- `POST /api/sessions/evaluate`: `{ "module_type": "alibi", "attempt_id": "..." }`. The server loads all three canonical question-answer pairs and the complete case metadata from persistence. It does not trust a client transcript, selected evidence, score, or session number. This is the new module-discriminated universal evaluation entry point; existing module evaluators remain compatible and unchanged.

`src/lib/alibi/contracts.ts` owns the evaluation schema. It follows existing `score`, `is_passed`, `criteria_scores`, `grammar_errors`, `vocabulary_upgrades`, and `rephrased_ideal_sentence` naming, adding evidence coverage, referenced consistency findings, recognition uncertainty, and suggestions. The server validates model JSON, checks literal transcript references, computes the specified weighted score, and derives passing at 75. Missing providers produce retriable errors, never fabricated passing evaluations.

`alibi_mutate` is executable only by `service_role`. Authenticated clients have read-only RLS access to their own new tables. Per-user transactional advisory locking serializes mutations. `(user_id, session_number)` uniquely identifies completion. Evaluation, completion, quest credit, and the shared progress/session records commit together. Repeated evaluation returns the stored result. A failed result never writes completion or daily quest credit. This module has one casebook of 15 sessions; it does not create a sixteenth session or unlock a second level.

Daily quest credit is awarded on the UTC date of a newly completed session. The original four-module daily goal and Open Mic unlock remain intact; `alibi_count` is additional practice credit. Failed attempt feedback is retained in history when a retry creates a new attempt.

## Voice lifecycle

The explicit phases are loading → briefing → fetching → speaking → ready → preparing → recording → transcribing → review → saving, repeated for three turns, then evaluating → verdict. Opening a case reads its briefing aloud; briefing playback never starts recording. User clicks unlock a playback AudioContext before network requests. Detective questions play through HTMLAudio, with unlocked Web Audio recovery for autoplay rejection and native browser speech as a final voice fallback. After the last voice backend finishes and cleans up, the microphone opens automatically. The 25-second deadline starts only on MediaRecorder's `start` event. An interrupted/explicitly stopped question stays locked until replay. A manual start button remains for microphone permission recovery or returning from a background tab. Playback is never allowed while a microphone stream exists. Recording uses `performance.now()` with a 25,000 ms deadline, early submission, and automatic stop. Hiding the page ends the answer early to avoid background timer throttling. The waveform reads microphone samples rather than simulated levels.

Transcription failures retain the current audio blob for retry. Saving failures retain the transcript and question. Audio blobs are held in memory only; only successfully saved transcripts survive reload. Tracks, AudioContexts, playback URLs, request signals, intervals, and animation frames are cleaned up on unmount. After a reload, an unsaved turn must be recorded again.

## Verification

- `node --test scripts/test-alibi.mjs scripts/test-tts.mjs`
- `node scripts/check-tts-live.mjs` verifies the real TTS endpoint using the configured server credentials.
- `npx.cmd tsc --noEmit`
- `npx.cmd eslint app/practice/alibi/page.tsx app/api/alibi/route.ts app/api/sessions/evaluate/route.ts src/lib/alibi`
- `npm.cmd run build`
- `node scripts/check-alibi-browser.mjs` (local dev server at port 3000 and a Chromium debugging endpoint at port 9229; configurable through `ALIBI_PREVIEW_URL` and `ALIBI_BROWSER_URL`). Browser checks use fixture API responses and real fake-device browser recording, so they do not consume provider credits or change user data.
- Set `ALIBI_LIVE_TTS=1` when running the browser check to use live Speechmatics speech for all three questions, the briefing, and reconstruction. Alibi question/persistence and STT responses still use fixtures. The default browser suite injects provider failure, blocked autoplay, native speech completion/failure, and explicit playback cancellation. Native speech callbacks are fixtures because headless machines may have no installed voices.
- To check a running production build without creating a test account, set `ALIBI_BUILT_DOCUMENT=1`. The browser harness fulfills only its own Alibi document navigation with the built `.next/server/app/practice/alibi.html` artifact. Application authentication stays intact; unauthenticated production navigation normally redirects to signup. The page still loads real production JS/CSS and, in live TTS mode, calls the real TTS endpoint.

If local Node requests fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` behind an HTTPS proxy, start the preview with `NODE_OPTIONS=--use-system-ca` on a Node version that supports it, or configure `NODE_EXTRA_CA_CERTS` with your organization's trusted CA bundle. This enables the appropriate trusted roots; never disable TLS certificate verification. The verification environment needed `--use-system-ca` for live Speechmatics calls.

The SQL transaction needs verification against a migrated staging database before deployment, including concurrent evaluation calls and rollback on a quest/progress write failure. Browser fixture checks cannot validate external Speechmatics/Gemini credentials, generated question quality, or database constraints that are not represented in this repository.
