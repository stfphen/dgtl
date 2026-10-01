// Shared Claude transport for all AI features. Two backends, one interface:
//   - "subscription": Claude Agent SDK, billed to a Claude Max/Pro plan
//     (auth via CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`).
//   - "apiKey": the Messages API (@anthropic-ai/sdk) billed to ANTHROPIC_API_KEY.
// Subscription is preferred when configured; the API key is an automatic
// fallback if a subscription call fails (and the key is present).
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { collectCitations, extractText, parseModelJson } from "./aiParse.js";

const DEFAULT_MODEL = process.env.LEAD_RESEARCH_MODEL || "claude-opus-4-8";

export function aiMode() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return "subscription";
  if (process.env.ANTHROPIC_API_KEY) return "apiKey";
  return "off";
}

export function aiNotConfiguredError() {
  const error = new Error(
    "AI is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (Claude subscription) or ANTHROPIC_API_KEY."
  );
  error.name = "AiNotConfigured";
  return error;
}

// Env for the Agent SDK subprocess: force the OAuth/subscription path by
// removing ANTHROPIC_API_KEY (the CLI prefers the API key when both are set).
function subscriptionEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return env;
}

function baseAgentOptions({ system, model, cwd, allowedTools }) {
  return {
    systemPrompt: system,
    model: model || DEFAULT_MODEL,
    allowedTools: allowedTools || [],
    disallowedTools: [],
    settingSources: [], // ignore this repo's CLAUDE.md / local settings
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    ...(cwd ? { cwd } : {}),
    env: subscriptionEnv()
  };
}

// Drain the Agent SDK message stream into a single result.
async function collectAgentResult(stream) {
  let resultMessage = null;
  const texts = [];
  const contents = [];
  for await (const message of stream) {
    if (message.type === "assistant" || message.type === "user") {
      const blocks = message.message?.content;
      if (Array.isArray(blocks)) {
        contents.push(...blocks);
        for (const block of blocks) {
          if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
        }
      }
    } else if (message.type === "result") {
      resultMessage = message;
    }
  }
  if (!resultMessage) throw new Error("Agent SDK returned no result message.");
  if (resultMessage.subtype !== "success") {
    const status = resultMessage.api_error_status ? ` (${resultMessage.api_error_status})` : "";
    throw new Error(`Agent run failed: ${resultMessage.subtype}${status}`);
  }
  return {
    text: typeof resultMessage.result === "string" ? resultMessage.result : texts.join("\n").trim(),
    structuredOutput: resultMessage.structured_output,
    contents
  };
}

// ---------------------------------------------------------------------------
// Subscription backend (Claude Agent SDK)
// ---------------------------------------------------------------------------
async function subscriptionWebResearch({ system, prompt, model }) {
  const result = await collectAgentResult(
    query({
      prompt,
      options: baseAgentOptions({ system, model, allowedTools: ["WebSearch", "WebFetch"] })
    })
  );
  return { text: result.text, citations: collectCitations(result.contents) };
}

async function subscriptionGenerateJson({ system, prompt, schema, documents, model }) {
  let dir = null;
  try {
    let finalPrompt = prompt;
    const allowedTools = [];
    if (documents?.length) {
      dir = await mkdtemp(join(tmpdir(), "tenant-docs-"));
      const names = [];
      for (const doc of documents) {
        const safeName = String(doc.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
        await writeFile(join(dir, safeName), Buffer.from(doc.base64, "base64"));
        names.push(safeName);
      }
      allowedTools.push("Read");
      finalPrompt = `${prompt}\n\nReference documents are in the working directory — read each before answering: ${names.join(", ")}`;
    }
    const result = await collectAgentResult(
      query({
        prompt: finalPrompt,
        options: {
          ...baseAgentOptions({ system, model, cwd: dir, allowedTools }),
          outputFormat: { type: "json_schema", schema }
        }
      })
    );
    if (result.structuredOutput != null && typeof result.structuredOutput === "object") {
      return result.structuredOutput;
    }
    return parseModelJson(result.text);
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// API-key backend (Messages API)
// ---------------------------------------------------------------------------
const WEB_TOOLS_MAX_CONTINUATIONS = 5;

async function apiKeyWebResearch({ system, prompt, model, maxWebSearches }) {
  const client = new Anthropic();
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: maxWebSearches },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxWebSearches }
  ];
  const messages = [{ role: "user", content: prompt }];
  let response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    tools,
    system,
    messages
  });

  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < WEB_TOOLS_MAX_CONTINUATIONS) {
    // Resume the server-tool loop; the API auto-resumes from the trailing
    // server_tool_use block — do NOT append a "Continue." user message.
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      tools,
      system,
      messages
    });
    continuations += 1;
  }
  if (response.stop_reason === "refusal") {
    const error = new Error("The model declined the request.");
    error.name = "AiRefused";
    throw error;
  }
  return { text: extractText(response), citations: collectCitations(response.content) };
}

function documentContentBlocks(documents) {
  const blocks = [];
  for (const doc of documents || []) {
    if (doc.mediaType === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.base64 }
      });
    } else {
      // Non-PDF docs are inlined into the prompt by the caller; if any slip
      // through, attach them as decoded text.
      blocks.push({
        type: "text",
        text: `Reference document "${doc.name}":\n${Buffer.from(doc.base64, "base64").toString("utf8")}`
      });
    }
  }
  return blocks;
}

async function apiKeyGenerateJson({ system, prompt, schema, documents, model }) {
  const client = new Anthropic();
  const content = [{ type: "text", text: prompt }, ...documentContentBlocks(documents)];
  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }]
  });
  if (response.stop_reason === "refusal") {
    const error = new Error("The model declined the request.");
    error.name = "AiRefused";
    throw error;
  }
  return parseModelJson(extractText(response));
}

// ---------------------------------------------------------------------------
// Public interface — subscription-first with API-key fallback
// ---------------------------------------------------------------------------
async function withFallback(subscriptionFn, apiKeyFn) {
  const mode = aiMode();
  if (mode === "off") throw aiNotConfiguredError();
  if (mode === "apiKey") return apiKeyFn();
  // subscription preferred; fall back to the API key if it's available.
  try {
    return await subscriptionFn();
  } catch (error) {
    if (process.env.ANTHROPIC_API_KEY) return apiKeyFn();
    throw error;
  }
}

/**
 * Research with live web search. Returns { text, citations }.
 */
export function runWebResearch({ system, prompt, model, maxWebSearches = 8 } = {}) {
  return withFallback(
    () => subscriptionWebResearch({ system, prompt, model }),
    () => apiKeyWebResearch({ system, prompt, model, maxWebSearches })
  );
}

/**
 * Generate a JSON object matching `schema`. Returns the parsed object (the
 * caller validates/sanitizes). `documents` are binary attachments (e.g. PDFs);
 * inline any text documents into `prompt` yourself.
 */
export function generateJson({ system, prompt, schema, documents = [], model } = {}) {
  return withFallback(
    () => subscriptionGenerateJson({ system, prompt, schema, documents, model }),
    () => apiKeyGenerateJson({ system, prompt, schema, documents, model })
  );
}

/**
 * One bounded chat turn with client-defined tools (Stage 6 DGTL.chat).
 *
 * Deliberately API-key-only: the subscription/Agent-SDK path runs with
 * bypassed permissions, which is safe for the empty/web-only tool sets above
 * but is NOT an acceptable substrate for a client-defined tool loop — Stage 6
 * keeps its confirmation gate in Core, outside any model permission system.
 * Bounded: explicit timeout, at most one retry (SDK-level), capped tokens.
 * Returns either { type: "tool_call", toolId, args, callId, usage } or
 * { type: "final", content, usage }. Never returns vendor response objects.
 */
export async function runChatToolTurn({ system, messages, tools, model, timeoutMs = 30_000, maxTokens = 1200 } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw aiNotConfiguredError();
  const client = new Anthropic({ timeout: timeoutMs, maxRetries: 1 });
  const encodeToolId = (id) => String(id).replaceAll(".", "__");
  const decodeToolId = (name) => String(name).replaceAll("__", ".");
  const clamp = (value, cap) => { const text = String(value ?? ""); return text.length > cap ? `${text.slice(0, cap)}…` : text; };
  const providerMessages = [];
  for (const message of messages || []) {
    if (message.role === "user") providerMessages.push({ role: "user", content: clamp(message.content, 4000) });
    else if (message.role === "assistant") providerMessages.push({ role: "assistant", content: clamp(message.content, 4000) });
    else if (message.role === "assistant_tool_call") providerMessages.push({ role: "assistant", content: [{ type: "tool_use", id: message.callId, name: encodeToolId(message.toolId), input: message.args || {} }] });
    else if (message.role === "tool_result") providerMessages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.callId, content: clamp(message.content, 6000) }] });
  }
  let response;
  try {
    response = await client.messages.create({
      model: model || process.env.CORE_CHAT_MODEL || "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      tools: (tools || []).map((tool) => ({ name: encodeToolId(tool.id), description: tool.description, input_schema: tool.inputSchema })),
      messages: providerMessages
    });
  } catch (error) {
    // Secret-safe: only a status/name reaches the caller, never headers/body.
    throw Object.assign(new Error(`Model provider error (${error?.status || error?.name || "unknown"}).`), { status: 502, code: "provider_error" });
  }
  if (response.stop_reason === "refusal") {
    const error = new Error("The model declined the request.");
    error.name = "AiRefused";
    throw error;
  }
  const usage = { inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null };
  const toolUse = (response.content || []).find((block) => block.type === "tool_use");
  if (toolUse) return { type: "tool_call", toolId: decodeToolId(toolUse.name), args: toolUse.input || {}, callId: toolUse.id, usage };
  return { type: "final", content: clamp(extractText(response), 8000), usage };
}
