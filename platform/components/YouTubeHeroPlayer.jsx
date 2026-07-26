"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { coverSize, hasHeroVideo } from "../lib/media/youtube";

/**
 * Muted, looping, non-interactive YouTube background for the funnel hero.
 * kind=video loops one video; kind=playlist plays in order and loops;
 * kind=channel plays the channel's uploads playlist shuffled (embeds cap
 * playlists at 200 items — accepted).
 *
 * Design rules (see 52-Decision-Log 2026-07-03 and 2026-07-04):
 * - IFrame Player API for ALL kinds: the iframe is revealed only on a real
 *   PLAYING event, so a deleted video / blocked embed / refused autoplay just
 *   leaves the hero image (which always stays underneath as poster + LCP).
 * - The load kicks off immediately on mount (poster still paints first and
 *   covers the hero until PLAYING); SSR renders an empty div.
 * - YouTube chrome can't be disabled (controls=0 still leaves the title band
 *   + watermark at start and center pause/skip buttons when paused), so:
 *   the iframe is oversized by CHROME_CROP to push edge chrome out of view,
 *   and any PAUSED/ENDED state resumes if possible or conceals the iframe
 *   behind the poster — the paused-state UI is never rendered to the visitor.
 * - Failure -> silent image fallback via a 10s no-PLAYING watchdog + onError.
 * - prefers-reduced-motion renders nothing (plus a CSS display:none guard).
 */

const WATCHDOG_MS = 10000;
const MAX_ERROR_SKIPS = 3;
// Fraction of hero height the iframe overflows top AND bottom, cropping
// YouTube's edge chrome (title band, watermark) out of the visible hero.
const CHROME_CROP = 0.12;
// After PAUSED/ENDED, how long a resume attempt gets before the poster
// conceals the iframe (so YouTube's pause UI is never visible).
const CONCEAL_MS = 600;
const MAX_RESUME_ATTEMPTS = 2;

// Singleton loader for https://www.youtube.com/iframe_api (dedupes strict-mode
// double-mounts and multiple heroes; onerror resets so a later mount retries).
let ytApiPromise;
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        ytApiPromise = undefined;
        reject(new Error("yt-api-blocked"));
      };
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
}

export default function YouTubeHeroPlayer({ video }) {
  const reducedMotion = useReducedMotion();
  const targetRef = useRef(null);
  const wrapperRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const playable = hasHeroVideo(video);
  const kind = video?.kind;
  const videoId = video?.videoId || "";
  const playlistId = video?.playlistId || "";
  const aspect = Number(video?.aspect) || 0;

  useEffect(() => {
    if (!playable || reducedMotion || typeof window === "undefined") return undefined;

    let cancelled = false;
    let player = null;
    let watchdog = null;
    let concealTimer = null;
    let resizeObserver = null;
    let visibilityHandler = null;
    const listConfigured = { current: false };
    const errorSkips = { current: 0 };
    const resumeAttempts = { current: 0 };

    // The image-fade hook: stamp the nearest hero container so CSS can fade
    // the poster out ([data-video-playing] .hero__image). An attribute React
    // doesn't render survives re-renders; removed on any teardown/failure.
    const setContainerPlaying = (on) => {
      const container = wrapperRef.current?.closest(".hero, .hero__media-frame");
      if (!container) return;
      if (on) container.setAttribute("data-video-playing", "true");
      else container.removeAttribute("data-video-playing");
    };

    // JS cover sizing (not CSS units): resilient across browsers and lets the
    // math crop in-player bars using the stored content aspect.
    const sizeIframe = () => {
      const wrapper = wrapperRef.current;
      const iframe = wrapper?.querySelector("iframe");
      if (!wrapper || !iframe) return;
      const rect = wrapper.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { width, height } = coverSize(rect.width, rect.height, aspect, CHROME_CROP);
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
    };

    // Every YT call goes through this so a torn-down player can't throw into React.
    const safe = (fn) => {
      try {
        return fn();
      } catch {
        return undefined;
      }
    };

    const fail = () => {
      if (cancelled) return;
      window.clearTimeout(watchdog);
      window.clearTimeout(concealTimer);
      setContainerPlaying(false);
      safe(() => player?.destroy());
      player = null;
      setFailed(true);
    };

    const start = async () => {
      // Hidden/occluded tabs pause embeds and transitions (Chrome defers
      // YouTube autoplay until visible) — starting the watchdog there would
      // kill the video before a background-tab visitor ever sees the page.
      // Wait for visibility before the clock starts.
      if (document.visibilityState === "hidden") {
        await new Promise((resolve) => {
          visibilityHandler = () => {
            if (document.visibilityState !== "hidden") resolve();
          };
          document.addEventListener("visibilitychange", visibilityHandler);
        });
        document.removeEventListener("visibilitychange", visibilityHandler);
        visibilityHandler = null;
        if (cancelled) return;
      }

      let YT;
      try {
        YT = await loadYouTubeApi();
      } catch {
        fail();
        return;
      }
      if (cancelled || !targetRef.current) return;

      watchdog = window.setTimeout(fail, WATCHDOG_MS);

      const playerVars = {
        autoplay: 1,
        mute: 1,
        controls: 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        origin: window.location.origin,
        ...(kind === "video"
          ? { loop: 1, playlist: videoId }
          : { listType: "playlist", list: playlistId })
      };

      try {
        player = new YT.Player(targetRef.current, {
          host: "https://www.youtube-nocookie.com",
          ...(kind === "video" ? { videoId } : {}),
          playerVars,
          events: {
            onReady: (event) => {
              safe(() => {
                event.target.mute();
                event.target.playVideo();
                const iframe = event.target.getIframe();
                if (iframe) {
                  iframe.title = "Background video";
                  iframe.tabIndex = -1;
                  iframe.referrerPolicy = "strict-origin-when-cross-origin";
                }
                sizeIframe();
                if (wrapperRef.current && typeof ResizeObserver === "function") {
                  resizeObserver = new ResizeObserver(sizeIframe);
                  resizeObserver.observe(wrapperRef.current);
                }
              });
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                // The paused embed shows center play/skip buttons that no
                // playerVar can remove — resume if the browser will let us,
                // and conceal behind the poster if playback doesn't return.
                if (document.visibilityState === "visible" && resumeAttempts.current < MAX_RESUME_ATTEMPTS) {
                  resumeAttempts.current += 1;
                  safe(() => event.target.playVideo());
                }
                window.clearTimeout(concealTimer);
                concealTimer = window.setTimeout(() => {
                  if (cancelled) return;
                  setContainerPlaying(false);
                  setPlaying(false);
                }, CONCEAL_MS);
                return;
              }
              if (event.data !== YT.PlayerState.PLAYING) return;
              window.clearTimeout(watchdog);
              window.clearTimeout(concealTimer);
              resumeAttempts.current = 0;
              if ((kind === "playlist" || kind === "channel") && !listConfigured.current) {
                listConfigured.current = true;
                safe(() => event.target.setLoop(true));
                if (kind === "channel") {
                  const jumped = safe(() => {
                    event.target.setShuffle(true);
                    const count = event.target.getPlaylist()?.length ?? 0;
                    if (count > 1) {
                      // Jump into the shuffled order so the hero doesn't always
                      // open on the newest upload; the re-buffer's own PLAYING
                      // event reveals the iframe.
                      event.target.playVideoAt(Math.floor(Math.random() * count));
                      return true;
                    }
                    return false;
                  });
                  if (jumped) return;
                }
              }
              safe(sizeIframe);
              setContainerPlaying(true);
              setPlaying(true);
            },
            onError: () => {
              if (cancelled) return;
              if (kind !== "video" && errorSkips.current < MAX_ERROR_SKIPS) {
                errorSkips.current += 1;
                safe(() => player?.nextVideo());
                return;
              }
              fail();
            }
          }
        });
      } catch {
        fail();
      }
    };

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(concealTimer);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
        visibilityHandler = null;
      }
      resizeObserver?.disconnect();
      setContainerPlaying(false);
      safe(() => player?.destroy());
      player = null;
    };
  }, [playable, reducedMotion, kind, videoId, playlistId, aspect]);

  // reducedMotion is null on the server/first paint — render the (empty,
  // invisible) wrapper then; only a confirmed `true` suppresses the video.
  if (!playable || reducedMotion === true || failed) return null;

  return (
    <div ref={wrapperRef} className={`hero__video${playing ? " is-playing" : ""}`} aria-hidden="true">
      <div ref={targetRef} />
    </div>
  );
}
