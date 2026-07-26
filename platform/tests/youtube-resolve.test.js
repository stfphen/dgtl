import assert from "node:assert/strict";
import test from "node:test";
import { resolveYouTubeInput } from "../lib/media/youtubeResolve.js";

const VID = "dQw4w9WgXcQ";
const LIST = "PLBCF2DAC6FFB574DE";
const CHANNEL = "UC" + "b".repeat(22);
const UPLOADS = "UU" + "b".repeat(22);

function jsonResponse(data, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

function htmlResponse(html, ok = true) {
  return { ok, status: ok ? 200 : 404, json: async () => ({}), text: async () => html };
}

// fetchImpl router keyed on substring match; records calls for assertions.
// Stub DNS lookup resolving every host to a public IP (safeFetch guard passes offline).
const publicLookup = async () => [{ address: "142.250.68.14", family: 4 }];

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push(String(url));
    for (const [needle, responder] of routes) {
      if (String(url).includes(needle)) return responder(url, options);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

test("video URL resolves without network beyond oEmbed, includes meta + aspect", async () => {
  const fetchImpl = fakeFetch([
    [
      "/oembed",
      () => jsonResponse({ title: "Great video", thumbnail_url: "https://i.ytimg.com/x.jpg", width: 480, height: 360 })
    ]
  ]);
  const result = await resolveYouTubeInput(`https://youtu.be/${VID}`, { fetchImpl });

  assert.deepEqual(result.heroVideo, {
    url: `https://youtu.be/${VID}`,
    kind: "video",
    videoId: VID,
    playlistId: "",
    aspect: Math.round((480 / 360) * 10000) / 10000
  });
  assert.equal(result.meta.title, "Great video");
  assert.equal(result.meta.thumbnail, "https://i.ytimg.com/x.jpg");
  assert.equal(fetchImpl.calls.length, 1);
});

test("missing oEmbed dims yield no aspect on the heroVideo", async () => {
  const fetchImpl = fakeFetch([["/oembed", () => jsonResponse({ title: "t" })]]);
  const result = await resolveYouTubeInput(`https://youtu.be/${VID}`, { fetchImpl });
  assert.ok(!("aspect" in result.heroVideo));
});

test("prefer switches a watch?v&list URL between video and playlist", async () => {
  const fetchImpl = fakeFetch([["/oembed", () => jsonResponse({})]]);
  const both = `https://www.youtube.com/watch?v=${VID}&list=${LIST}`;

  const asVideo = await resolveYouTubeInput(both, { prefer: "video", fetchImpl });
  assert.equal(asVideo.heroVideo.kind, "video");
  assert.equal(asVideo.heroVideo.videoId, VID);
  assert.equal(asVideo.heroVideo.playlistId, "");
  assert.deepEqual(asVideo.meta.detected, { videoId: VID, playlistId: LIST });

  const asPlaylist = await resolveYouTubeInput(both, { prefer: "playlist", fetchImpl });
  assert.equal(asPlaylist.heroVideo.kind, "playlist");
  assert.equal(asPlaylist.heroVideo.playlistId, LIST);
  assert.equal(asPlaylist.heroVideo.videoId, "");
});

test("/channel/UC… URL resolves offline to the uploads playlist", async () => {
  const fetchImpl = fakeFetch([]);
  const result = await resolveYouTubeInput(`https://www.youtube.com/channel/${CHANNEL}`, {
    fetchImpl
  });
  assert.equal(result.heroVideo.kind, "channel");
  assert.equal(result.heroVideo.playlistId, UPLOADS);
  assert.equal(fetchImpl.calls.length, 0); // channels get no oEmbed
});

test("@handle resolves via Data API when YOUTUBE_API_KEY is set", async (t) => {
  process.env.YOUTUBE_API_KEY = "test-key";
  t.after(() => delete process.env.YOUTUBE_API_KEY);

  const fetchImpl = fakeFetch([
    ["googleapis.com/youtube/v3/channels", () => jsonResponse({ items: [{ id: CHANNEL }] })]
  ]);
  const result = await resolveYouTubeInput("https://www.youtube.com/@SomeCreator", { fetchImpl });

  assert.equal(result.heroVideo.kind, "channel");
  assert.equal(result.heroVideo.playlistId, UPLOADS);
  assert.ok(fetchImpl.calls[0].includes("forHandle=%40SomeCreator"));
});

test("@handle falls back to the SSRF-guarded page scrape without an API key", async (t) => {
  delete process.env.YOUTUBE_API_KEY;
  const fetchImpl = fakeFetch([
    [
      "youtube.com/@SomeCreator",
      () => htmlResponse(`<html><script>var x = {"channelId":"${CHANNEL}","title":"x"};</script></html>`)
    ]
  ]);
  const result = await resolveYouTubeInput("https://www.youtube.com/@SomeCreator", {
    fetchImpl,
    lookup: publicLookup
  });

  assert.equal(result.heroVideo.kind, "channel");
  assert.equal(result.heroVideo.playlistId, UPLOADS);
});

test("unresolvable channels and non-YouTube links throw YouTubeResolveError", async () => {
  const emptyPage = fakeFetch([["youtube.com/@Ghost", () => htmlResponse("<html>no id here</html>")]]);
  await assert.rejects(
    () =>
      resolveYouTubeInput("https://www.youtube.com/@Ghost", {
        fetchImpl: emptyPage,
        lookup: publicLookup
      }),
    (error) => error.name === "YouTubeResolveError" && /Could not resolve/.test(error.message)
  );

  await assert.rejects(
    () => resolveYouTubeInput("https://vimeo.com/123", { fetchImpl: fakeFetch([]) }),
    (error) => error.name === "YouTubeResolveError"
  );
});

test("oEmbed failure degrades to empty meta, never throws", async () => {
  const fetchImpl = fakeFetch([
    [
      "/oembed",
      () => {
        throw new Error("network down");
      }
    ]
  ]);
  const result = await resolveYouTubeInput(`https://youtu.be/${VID}`, { fetchImpl });
  assert.equal(result.heroVideo.videoId, VID);
  assert.equal(result.meta.title, "");
  assert.equal(result.meta.thumbnail, "");
});
