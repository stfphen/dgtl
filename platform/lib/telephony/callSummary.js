// Turn a call transcript into a short CRM summary using the shared Claude backend
// (subscription or API key). Returns a plain-text summary, or null when AI is not
// configured / the transcript is empty / the model declines. Never throws.

import { aiMode, generateJson } from "../ai/claudeBackend.js";

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    outcome: { type: "string" },
    nextStep: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } }
  },
  required: ["summary", "outcome", "nextStep", "keyPoints"]
};

const SYSTEM =
  "You summarize B2B sales call transcripts for a CRM. Be concise and factual. " +
  "Use only what is in the transcript — never invent commitments, names, or numbers. " +
  "If the transcript is too short or unclear to summarize, say so plainly.";

// Format the structured result into the plain text stored on Call.aiSummary.
function formatSummary(out) {
  if (!out || typeof out !== "object") return "";
  const parts = [];
  if (out.summary) parts.push(String(out.summary).trim());
  if (out.outcome) parts.push(`Outcome: ${String(out.outcome).trim()}`);
  if (out.nextStep) parts.push(`Next step: ${String(out.nextStep).trim()}`);
  if (Array.isArray(out.keyPoints) && out.keyPoints.length) {
    parts.push("Key points:\n- " + out.keyPoints.map((p) => String(p).trim()).filter(Boolean).join("\n- "));
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function summarizeCallTranscript(transcript) {
  const text = String(transcript || "").trim();
  if (aiMode() === "off" || !text) return null;
  const prompt = [
    "Summarize this outbound sales call transcript for the rep's CRM record.",
    "Keep it tight: 2–4 sentences of summary, the outcome, and the next step.",
    "",
    "TRANSCRIPT:",
    text.slice(0, 16000)
  ].join("\n");
  try {
    const out = await generateJson({ system: SYSTEM, prompt, schema: SUMMARY_SCHEMA });
    const formatted = formatSummary(out);
    return formatted || null;
  } catch {
    return null;
  }
}
