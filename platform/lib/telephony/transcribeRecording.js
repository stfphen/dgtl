// In-app call transcription: fetch the recording audio, transcribe it, then
// summarize with the shared Claude backend. This avoids Twilio Conversational
// Intelligence (which needs a paid account) — it only needs the recording audio,
// so it works on a Twilio trial.
//
// Engine: Deepgram (primary, DEEPGRAM_API_KEY) with OpenAI Whisper as an
// automatic fallback if only OPENAI_API_KEY is set. Anthropic/Claude can't take
// audio, so a dedicated speech-to-text service is required for the transcript;
// Claude still writes the summary.

import { addCallEvent, updateCall } from "../store.js";
import { summarizeCallTranscript } from "./callSummary.js";

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || "nova-3";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export function inAppTranscriptionAvailable() {
  return Boolean(process.env.DEEPGRAM_API_KEY || process.env.OPENAI_API_KEY);
}

// Resolve a recording URL to an absolute URL. Provider recordings (Twilio) are
// already absolute; the mock/demo sample is a site-relative path like
// "/audio/sample-call.wav", which Node's fetch() cannot parse on its own — so we
// resolve it against the app origin.
function resolveRecordingUrl(recordingUrl) {
  if (/^https?:\/\//i.test(recordingUrl)) return recordingUrl;
  const base =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:8088";
  return new URL(recordingUrl, base).toString();
}

// Fetch the recording bytes. Twilio media URLs need account Basic auth; other
// URLs (e.g. the mock sample) are fetched plainly.
async function fetchRecordingBytes(recordingUrl) {
  const url = resolveRecordingUrl(recordingUrl);
  const headers = {};
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (url.includes("api.twilio.com") && sid && token) {
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`recording fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribeWithDeepgram(bytes) {
  const url = `${DEEPGRAM_URL}?model=${encodeURIComponent(DEEPGRAM_MODEL)}&smart_format=true&punctuate=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/mpeg"
    },
    body: bytes
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Deepgram failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  return String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").trim();
}

async function transcribeWithOpenAI(bytes) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "recording.mp3");
  form.append("model", OPENAI_MODEL);
  form.append("response_format", "text");
  const res = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI transcription failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return (await res.text()).trim();
}

// Transcribe an audio URL to text. Returns "" when no engine is configured.
// Throws on a hard failure (caller decides how to handle).
export async function transcribeAudio(recordingUrl) {
  if (!inAppTranscriptionAvailable() || !recordingUrl) return "";
  const bytes = await fetchRecordingBytes(recordingUrl);
  if (process.env.DEEPGRAM_API_KEY) return transcribeWithDeepgram(bytes);
  return transcribeWithOpenAI(bytes);
}

// Orchestrate: transcribe -> store transcript -> summarize (Claude) -> store
// summary -> log a call event. Best-effort; never throws so it's safe to call
// fire-and-forget from a webhook. Returns { ok, transcript, aiSummary }.
export async function transcribeAndSummarizeCall(call) {
  if (!call?.id) return { ok: false, error: "missing call" };
  try {
    const transcript = await transcribeAudio(call.recordingUrl);
    if (!transcript) {
      await addCallEvent(call.id, "transcription", { note: "empty or unavailable" });
      return { ok: false, error: "no transcript" };
    }
    const updates = { transcript };
    const aiSummary = await summarizeCallTranscript(transcript);
    if (aiSummary) updates.aiSummary = aiSummary;
    await updateCall(call.id, updates);
    await addCallEvent(call.id, "transcription", {
      engine: process.env.DEEPGRAM_API_KEY ? "deepgram" : "openai",
      chars: transcript.length,
      summarized: Boolean(aiSummary)
    });
    return { ok: true, transcript, aiSummary: aiSummary || "" };
  } catch (error) {
    await addCallEvent(call.id, "transcription", { error: error?.message || "failed" }).catch(() => {});
    return { ok: false, error: error?.message || "failed" };
  }
}
