"use client";

// DGTL Pass — the door scanner (docs/specs/dgtl-pass/06-scanner.md).
// Design target: docs/specs/dgtl-pass/previews/scanner.html.
//
// Rules this component never breaks:
//   - It never admits on an error. Offline, timeout, 5xx, signed out: no green.
//   - A retry reuses the same scan id, so a flaky network cannot admit twice.
//   - The verdict comes from the server's database, never from the code itself.
//
// Decoding is zxing-wasm (iOS Safari has no BarcodeDetector), self-hosted at
// /scan/zxing_reader.wasm so the door never depends on a CDN. Live camera needs
// a secure context (HTTPS or localhost); on plain-http Wi-Fi the scanner falls
// back to the phone's camera via a photo, which works everywhere.

import { useCallback, useEffect, useRef, useState } from "react";
import DgtlWordmark from "../brand/DgtlWordmark";

const WASM_URL = "/scan/zxing_reader.wasm";
const READER_OPTIONS = { formats: ["QRCode", "Code128"], tryHarder: true, maxNumberOfSymbols: 1 };
const DEBOUNCE_MS = 3000;
const ADMIT_RETURN_MS = 2500;
const VERIFY_TIMEOUT_MS = 6000;
const MANUAL_MISS_LIMIT = 10;
const GATE_KEY = "dgtl-scan-gate";

let readerPromise = null;
function loadReader() {
  if (!readerPromise) {
    readerPromise = import("zxing-wasm/reader")
      .then(async (mod) => {
        await mod.prepareZXingModule({
          overrides: { locateFile: (file, prefix) => (file.endsWith(".wasm") ? WASM_URL : prefix + file) },
          fireImmediately: true
        });
        return mod;
      })
      .catch((error) => {
        readerPromise = null;
        throw error;
      });
  }
  return readerPromise;
}

async function decode(input) {
  const { readBarcodes } = await loadReader();
  const results = await readBarcodes(input, READER_OPTIONS);
  const hit = results.find((result) => result.isValid && result.text);
  return hit ? { text: hit.text, kind: /code128/i.test(hit.format) ? "barcode" : "qr" } : null;
}

// crypto.randomUUID needs a secure context; getRandomValues works on plain http too.
function scanId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `scan_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function ago(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

function formatManual(raw) {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 26);
  return cleaned.length > 4 && cleaned.length <= 8 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}

// One fact per line: staff read these at arm's length.
function verdictDetail(v) {
  switch (v.result) {
    case "valid":
      return [v.validityLabel, v.useCount ? `Visit ${v.useCount}${v.maxUses ? ` of ${v.maxUses}` : ""}` : null].filter(Boolean);
    case "recently_used":
      return [
        v.lastUsedAt ? `Admitted ${ago(v.lastUsedAt)}${v.lastUsedGate ? ` at ${v.lastUsedGate}` : ""}` : null,
        v.retryAfterSeconds ? `Re-entry opens in ${Math.floor(v.retryAfterSeconds / 60)}:${String(v.retryAfterSeconds % 60).padStart(2, "0")}` : null
      ].filter(Boolean);
    case "used":
      return v.lastUsedAt ? `Used ${clock(v.lastUsedAt)}${v.lastUsedGate ? ` at ${v.lastUsedGate}` : ""}` : "Every entry on this pass is used.";
    case "expired":
    case "not_yet_valid":
      return v.validityLabel || "";
    case "revoked":
      return "Cancelled by the venue. Do not admit.";
    case "suspended":
      return "On hold. Ask a manager.";
    default:
      return "This code is not a pass for this venue.";
  }
}

const ICONS = {
  admit: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warn: <path d="M12 5v9M12 19h.01" />,
  deny: <path d="M6 6l12 12M18 6L6 18" />
};

export default function Scanner({ configured, user, teamName, gates, art }) {
  const [screen, setScreen] = useState({ kind: configured ? "start" : "unconfigured" });
  const [gate, setGate] = useState(gates[0] || "Main door");
  const [recent, setRecent] = useState([]);
  const [liveCamera, setLiveCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [torch, setTorch] = useState({ available: false, on: false });
  const [manual, setManual] = useState("");
  const [misses, setMisses] = useState(0);
  const [toast, setToast] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const lastRef = useRef({ text: "", at: 0 });
  const audioRef = useRef(null);
  const wakeRef = useRef(null);
  const returnRef = useRef(null);
  // The decode loop is a long-lived interval: it reads the latest gate and
  // camera state through refs instead of closing over a stale render.
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const liveRef = useRef(false);
  liveRef.current = liveCamera;
  const backRef = useRef(null);

  // Client-only capability checks (no hydration mismatch).
  useEffect(() => {
    setLiveCamera(Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia));
    try {
      const saved = window.localStorage.getItem(GATE_KEY);
      if (saved && gates.includes(saved)) setGate(saved);
    } catch {
      // storage unavailable: keep the first gate
    }
    // Warm the decoder while staff read the start screen.
    loadReader().catch(() => {});
  }, [gates]);

  const chooseGate = (value) => {
    setGate(value);
    try {
      window.localStorage.setItem(GATE_KEY, value);
    } catch {
      // ignore
    }
  };

  // ---- sound + haptics (iOS needs the start tap to unlock audio) ----
  const tone = useCallback((kind) => {
    const ctx = audioRef.current;
    if (ctx) {
      const plan = kind === "admit" ? [[880, 0, 0.09], [1320, 0.1, 0.12]] : kind === "warn" ? [[330, 0, 0.12], [330, 0.2, 0.12]] : [[180, 0, 0.5]];
      for (const [frequency, start, length] of plan) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequency;
        osc.type = kind === "deny" ? "square" : "sine";
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + length + 0.02);
      }
    }
    navigator.vibrate?.(kind === "admit" ? 60 : kind === "warn" ? [60, 80, 60] : 300);
  }, []);

  const unlockAudio = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioRef.current) audioRef.current = new Ctx();
      audioRef.current?.resume?.();
    } catch {
      audioRef.current = null;
    }
  };

  // ---- camera ----
  const stopCamera = useCallback(() => {
    clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    wakeRef.current?.release?.().catch?.(() => {});
    wakeRef.current = null;
    setTorch({ available: false, on: false });
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const acquireWakeLock = useCallback(async () => {
    try {
      if (navigator.wakeLock && document.visibilityState === "visible") wakeRef.current = await navigator.wakeLock.request("screen");
    } catch {
      wakeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && streamRef.current) acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquireWakeLock]);

  // ---- verify: same scan id on every retry; never admit on error ----
  const finishVerdict = useCallback(
    (verdict) => {
      setRecent((list) => [{ id: verdict.scanId, name: verdict.holderName || "Unknown", result: verdict.result, tone: verdict.tone, at: Date.now() }, ...list].slice(0, 5));
      tone(verdict.tone);
      setScreen({ kind: "verdict", verdict });
      clearTimeout(returnRef.current);
      if (verdict.tone === "admit") returnRef.current = setTimeout(() => backRef.current?.(), ADMIT_RETURN_MS);
    },
    [tone]
  );

  const verify = useCallback(
    async ({ raw, inputKind, id = scanId() }) => {
      pausedRef.current = true;
      setScreen({ kind: "checking" });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
        try {
          const response = await fetch("/api/scan/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ scanId: id, raw, inputKind, gate: gateRef.current, deviceLabel: navigator.platform || "browser" }),
            signal: controller.signal,
            cache: "no-store"
          });
          clearTimeout(timer);
          if (response.status === 401) {
            setScreen({ kind: "signedout" });
            return null;
          }
          if (response.status === 429) {
            setScreen({ kind: "offline", reason: "slow", retry: { raw, inputKind, id } });
            return null;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const verdict = await response.json();
          finishVerdict(verdict);
          return verdict;
        } catch {
          clearTimeout(timer);
          if (attempt < 2) await sleep(400 * (attempt + 1));
        }
      }
      tone("deny");
      setScreen({ kind: "offline", reason: "network", retry: { raw, inputKind, id } });
      return null;
    },
    [finishVerdict, tone]
  );

  const onDecoded = useCallback(
    (hit) => {
      const now = Date.now();
      if (hit.text === lastRef.current.text && now - lastRef.current.at < DEBOUNCE_MS) return;
      lastRef.current = { text: hit.text, at: now };
      verify({ raw: hit.text, inputKind: hit.kind });
    },
    [verify]
  );

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (busyRef.current || pausedRef.current || !video || !canvas || video.readyState < 2) return;
    busyRef.current = true;
    try {
      // Decode the centre square at ≤640 px: fast, and where staff aim.
      const side = Math.min(video.videoWidth, video.videoHeight);
      const scale = Math.min(1, 640 / side);
      canvas.width = Math.round(side * scale);
      canvas.height = Math.round(side * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      const hit = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (hit && !pausedRef.current) onDecoded(hit);
    } catch {
      // a bad frame is not an event
    } finally {
      busyRef.current = false;
    }
  }, [onDecoded]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
      const track = stream.getVideoTracks()[0];
      setTorch({ available: Boolean(track?.getCapabilities?.().torch), on: false });
      pausedRef.current = false;
      clearInterval(loopRef.current);
      loopRef.current = setInterval(tick, 125); // ~8 frames a second
      acquireWakeLock();
    } catch (error) {
      setCameraError(error?.name === "NotAllowedError" ? "Camera permission was refused. Allow it in Settings, or use a photo." : "The camera could not start. Use a photo or enter the code.");
    }
  }, [tick, acquireWakeLock]);

  const begin = async () => {
    unlockAudio();
    setScreen({ kind: "scanning" });
    if (liveCamera) {
      // The video element mounts with the scanning screen.
      await sleep(0);
      startCamera();
    }
  };

  backRef.current = () => {
    clearTimeout(returnRef.current);
    setScreen({ kind: "scanning" });
    pausedRef.current = false;
    if (liveRef.current && !streamRef.current) setTimeout(startCamera, 0);
  };
  const backToCamera = () => backRef.current();

  // The <video> remounts with the scanning screen: reattach the stream.
  useEffect(() => {
    if (screen.kind === "scanning" && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [screen.kind]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((value) => ({ ...value, on: !value.on }));
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  const onPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    unlockAudio();
    setToast("");
    try {
      const hit = await decode(file);
      if (!hit) {
        setToast("No code found in that photo. Hold the phone steady, fill the frame with the QR, and try again.");
        return;
      }
      lastRef.current = { text: hit.text, at: Date.now() };
      verify({ raw: hit.text, inputKind: hit.kind });
    } catch {
      setToast("The decoder failed to load. Check the connection and try again.");
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    if (misses >= MANUAL_MISS_LIMIT) return;
    const verdict = await verify({ raw: manual, inputKind: "manual" });
    if (verdict && ["not_found", "invalid_format"].includes(verdict.result)) setMisses((n) => n + 1);
    if (verdict?.admit) setMisses(0);
    setManual("");
  };

  // ---------------------------------------------------------------- render
  const header = (
    <header className="sc-bar">
      <DgtlWordmark className="sc-wordmark" title="DGTL" />
      {gates.length > 1 ? (
        <label className="sc-gate">
          <span className="sr-only">Gate</span>
          <select value={gate} onChange={(event) => chooseGate(event.target.value)}>
            {gates.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      ) : (
        <span className="sc-gate">{gate}</span>
      )}
      <span className="sc-online">Online</span>
    </header>
  );

  const photoButton = (label, primary = false) => (
    <label className={`sc-btn${primary ? " is-primary" : ""}`}>
      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" />
      {label}
    </label>
  );

  if (screen.kind === "unconfigured") {
    return (
      <>
        {header}
        <main className="sc-start">
          <img src={art.spark} alt="" className="sc-spark" />
          <h1>Scanner not set up</h1>
          <p>Passes are not configured on this server yet, so nothing can be verified. Ask an admin.</p>
        </main>
      </>
    );
  }

  if (screen.kind === "verdict") {
    const v = screen.verdict;
    const tier = art.tiers[v.tier];
    const auto = v.tone === "admit";
    return (
      <button type="button" className="sc-verdict-wrap" onClick={backToCamera} aria-label="Continue scanning">
        {v.vip && v.admit ? (
          <div className="sc-vip-band"><img src={art.spark} alt="" />VIP · Lifetime</div>
        ) : null}
        <div className={`sc-verdict is-${v.tone}`}>
          <div className="sc-v-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{ICONS[v.tone]}</svg>
          </div>
          <div className="sc-v-title" role="alert" aria-live="assertive">{v.title}</div>
          {v.holderName ? <div className="sc-v-name">{v.holderName}</div> : null}
          {tier && v.passTypeName ? (
            <span className="sc-v-tier" style={{ "--tier": tier.accent }}>
              <img src={art.spark} alt="" />
              {tier.label && !v.passTypeName.toLowerCase().includes(tier.label.toLowerCase()) ? `${tier.label} · ${v.passTypeName}` : v.passTypeName}
            </span>
          ) : null}
          <div className="sc-v-detail">
            {[].concat(verdictDetail(v)).map((line) => <span key={line}>{line}</span>)}
          </div>
          {auto ? <div className="sc-v-progress" aria-hidden><span /></div> : null}
          <div className="sc-v-foot">{auto ? "Continues automatically · tap to skip" : "Tap to continue"}</div>
        </div>
      </button>
    );
  }

  if (screen.kind === "offline") {
    return (
      <>
        {header}
        <main className="sc-offline" role="alert" aria-live="assertive">
          <div className="sc-v-icon is-outline" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18" /></svg>
          </div>
          <span className="sc-pill is-error">Don&apos;t admit</span>
          <h1>{screen.reason === "slow" ? "Slow down" : "No connection"}</h1>
          <p>
            {screen.reason === "slow"
              ? "Too many scans in a minute. Wait a moment, then retry."
              : "Can't verify this pass. Check Wi-Fi or mobile data, then retry. The retry reuses the same scan, so nobody is admitted twice."}
          </p>
          <div className="sc-row">
            <button type="button" className="sc-btn is-primary" onClick={() => verify(screen.retry)}>Retry →</button>
            <button type="button" className="sc-btn" onClick={backToCamera}>Back</button>
          </div>
        </main>
      </>
    );
  }

  if (screen.kind === "signedout") {
    return (
      <>
        {header}
        <main className="sc-start">
          <h1>Signed out</h1>
          <p>Your session ended. Sign in again to keep scanning. Nothing was admitted.</p>
          <a className="sc-btn is-primary" href="/admin/login">Sign in again →</a>
        </main>
      </>
    );
  }

  if (screen.kind === "manual") {
    const locked = misses >= MANUAL_MISS_LIMIT;
    return (
      <>
        {header}
        <main className="sc-manual">
          <p className="sc-eyebrow">Manual entry</p>
          <h1>Type the pass code</h1>
          <form onSubmit={submitManual} className="sc-manual__form">
            <label htmlFor="sc-code" className="sc-label">Pass code</label>
            <input
              id="sc-code"
              className="sc-code-input"
              value={manual}
              onChange={(event) => setManual(formatManual(event.target.value))}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              inputMode="text"
              placeholder="XXXX-XXXX"
              aria-describedby="sc-code-help"
              disabled={locked}
              autoFocus
            />
            <p id="sc-code-help" className="sc-note">
              {locked ? "Too many unknown codes. Ask a manager before trying again." : "8 characters, printed under the QR. O and 0 are the same."}
            </p>
            <button type="submit" className="sc-btn is-primary" disabled={locked || manual.replace(/-/g, "").length < 8}>Check code →</button>
            <button type="button" className="sc-btn is-ghost" onClick={backToCamera}>Back to camera</button>
          </form>
        </main>
      </>
    );
  }

  if (screen.kind === "start") {
    return (
      <>
        {header}
        <main className="sc-start">
          <img src={art.spark} alt="" className="sc-spark" />
          <h1>Ready at {gate}</h1>
          <p>Signed in as {user.name}{teamName ? ` · ${teamName}` : ""}</p>
          <button type="button" className="sc-btn is-primary sc-wide" onClick={begin}>Start scanning →</button>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="sc-btn is-ghost">Sign out</button>
          </form>
        </main>
      </>
    );
  }

  // scanning / checking
  const checking = screen.kind === "checking";
  return (
    <>
      {header}
      <main className="sc-scan">
        <div className="sc-cam">
          {liveCamera ? (
            <video ref={videoRef} className="sc-video" playsInline muted aria-label="Camera" />
          ) : (
            <div className="sc-nocam">
              <p>Live camera needs HTTPS. Take a photo of the pass QR instead: it is checked the same way.</p>
              {photoButton("Take a photo of the code →", true)}
            </div>
          )}
          {liveCamera ? (
            <div className="sc-finder" aria-hidden><i /><i /><i /><i /></div>
          ) : null}
          <p className="sc-cam-hint" aria-live="polite">{checking ? "Checking…" : liveCamera ? "Point at the QR code" : ""}</p>
          {cameraError ? <p className="sc-cam-error" role="alert">{cameraError}</p> : null}
        </div>
        <canvas ref={canvasRef} hidden />
        {toast ? <p className="sc-toast" role="status">{toast}</p> : null}
        <div className="sc-controls">
          <button type="button" className="sc-btn" onClick={() => { pausedRef.current = true; setScreen({ kind: "manual" }); }}>Enter code</button>
          {liveCamera ? photoButton("Photo") : null}
          {torch.available ? (
            <button type="button" className={`sc-btn${torch.on ? " is-on" : ""}`} onClick={toggleTorch} aria-pressed={torch.on}>Torch</button>
          ) : null}
        </div>
        {recent.length ? (
          <ol className="sc-recent" aria-label="Recent scans">
            {recent.map((item) => (
              <li key={item.id}>
                <span className={`sc-pill is-${item.tone === "admit" ? "success" : item.tone === "warn" ? "warning" : "error"}`}>
                  {item.tone === "admit" ? "Valid" : item.tone === "warn" ? "Check" : "Refused"}
                </span>
                <span>{item.name}</span>
                <span>{clock(item.at)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </main>
    </>
  );
}
