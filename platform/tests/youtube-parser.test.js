import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_HERO_VIDEO,
  hasHeroVideo,
  parseYouTubeUrl,
  sanitizeHeroVideo,
  uploadsPlaylistFor
} from "../lib/media/youtube.js";

const VID = "dQw4w9WgXcQ";
const LIST = "PLBCF2DAC6FFB574DE";
const CHANNEL = "UC" + "a".repeat(22);
const UPLOADS = "UU" + "a".repeat(22);

test("parseYouTubeUrl classifies every supported URL form", () => {
  const cases = [
    // [input, expected subset]
    [`https://www.youtube.com/watch?v=${VID}`, { kind: "video", videoId: VID, playlistId: "" }],
    [`https://youtube.com/watch?v=${VID}&t=42s`, { kind: "video", videoId: VID }],
    [`https://m.youtube.com/watch?v=${VID}`, { kind: "video", videoId: VID }],
    [`https://youtu.be/${VID}`, { kind: "video", videoId: VID }],
    [`https://youtu.be/${VID}?si=xyz`, { kind: "video", videoId: VID }],
    [`www.youtube.com/watch?v=${VID}`, { kind: "video", videoId: VID }], // scheme-less
    [`https://www.youtube.com/shorts/${VID}`, { kind: "video", videoId: VID }],
    [`https://www.youtube.com/live/${VID}`, { kind: "video", videoId: VID }],
    [`https://www.youtube.com/embed/${VID}`, { kind: "video", videoId: VID }],
    [`https://www.youtube-nocookie.com/embed/${VID}`, { kind: "video", videoId: VID }],
    [`https://www.youtube.com/playlist?list=${LIST}`, { kind: "playlist", playlistId: LIST }],
    [`https://www.youtube.com/embed/videoseries?list=${LIST}`, { kind: "playlist", playlistId: LIST }],
    [`https://www.youtube.com/watch?list=${LIST}`, { kind: "playlist", playlistId: LIST }],
    // Both v= and list= → video, with the playlist offered alongside:
    [
      `https://www.youtube.com/watch?v=${VID}&list=${LIST}&index=3`,
      { kind: "video", videoId: VID, playlistId: LIST }
    ],
    [
      `https://www.youtube.com/channel/${CHANNEL}`,
      { kind: "channel", channelId: CHANNEL, playlistId: UPLOADS, needsResolution: false }
    ],
    [
      "https://www.youtube.com/@SomeCreator",
      { kind: "channel", handle: "SomeCreator", handleType: "handle", needsResolution: true }
    ],
    [
      "https://www.youtube.com/c/SomeStudio",
      { kind: "channel", handle: "SomeStudio", handleType: "c", needsResolution: true }
    ],
    [
      "https://www.youtube.com/user/legacyname",
      { kind: "channel", handle: "legacyname", handleType: "user", needsResolution: true }
    ]
  ];

  for (const [input, expected] of cases) {
    const parsed = parseYouTubeUrl(input);
    assert.ok(parsed, `expected a parse for ${input}`);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(parsed[key], value, `${input} → ${key}`);
    }
  }
});

test("parseYouTubeUrl rejects non-YouTube and hostile input", () => {
  const rejected = [
    "",
    null,
    "not a url",
    "https://vimeo.com/12345",
    "https://evil.example/watch?v=" + VID,
    "https://youtube.com.evil.example/watch?v=" + VID,
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=short", // bad id length
    "https://www.youtube.com/watch", // no v, no list
    "https://www.youtube.com/playlist", // no list
    "https://www.youtube.com/channel/notachannelid",
    "https://www.youtube.com/@", // empty handle
    "https://www.youtube.com/results?search_query=x",
    "https://www.youtube.com/feed/subscriptions",
    // Mixes (RD…) are not embeddable playlists:
    "https://www.youtube.com/watch?list=RDdQw4w9WgXcQ",
    "https://" + "a".repeat(600) + ".com/watch?v=" + VID // oversized input
  ];
  for (const input of rejected) {
    assert.equal(parseYouTubeUrl(input), null, `expected null for ${String(input).slice(0, 60)}`);
  }
});

test("uploadsPlaylistFor derives UU playlists only from UC channel ids", () => {
  assert.equal(uploadsPlaylistFor(CHANNEL), UPLOADS);
  assert.equal(uploadsPlaylistFor("UU" + "a".repeat(22)), "");
  assert.equal(uploadsPlaylistFor("nope"), "");
  assert.equal(uploadsPlaylistFor(""), "");
});

test("sanitizeHeroVideo coerces invalid input to the empty block", () => {
  const empties = [
    undefined,
    null,
    "string",
    [],
    {},
    { kind: "video" }, // no id
    { kind: "video", videoId: "short" },
    { kind: "playlist", playlistId: "" },
    { kind: "playlist", playlistId: "RD" + "x".repeat(20) }, // mix
    { kind: "vaporwave", videoId: VID },
    { kind: "channel", videoId: VID } // channel without playlist
  ];
  for (const input of empties) {
    assert.deepEqual(sanitizeHeroVideo(input), EMPTY_HERO_VIDEO, JSON.stringify(input));
  }
});

test("sanitizeHeroVideo keeps valid blocks and scrubs cross-field noise", () => {
  const video = sanitizeHeroVideo({
    url: `https://youtu.be/${VID}`,
    kind: "video",
    videoId: VID,
    playlistId: LIST // ignored for kind video
  });
  assert.deepEqual(video, { url: `https://youtu.be/${VID}`, kind: "video", videoId: VID, playlistId: "" });

  const playlist = sanitizeHeroVideo({ kind: "playlist", playlistId: LIST, videoId: VID, url: "" });
  assert.deepEqual(playlist, { url: "", kind: "playlist", videoId: "", playlistId: LIST });

  const channel = sanitizeHeroVideo({
    url: "https://www.youtube.com/@SomeCreator",
    kind: "channel",
    playlistId: UPLOADS
  });
  assert.equal(channel.kind, "channel");
  assert.equal(channel.playlistId, UPLOADS);

  // Non-YouTube display url is scrubbed but the block survives:
  const scrubbed = sanitizeHeroVideo({ url: "https://evil.example/x", kind: "video", videoId: VID });
  assert.equal(scrubbed.url, "");
  assert.equal(scrubbed.videoId, VID);
});

test("sanitizeHeroVideo passes through a valid aspect and drops junk", () => {
  const base = { kind: "video", videoId: VID, url: "" };
  assert.equal(sanitizeHeroVideo({ ...base, aspect: 4 / 3 }).aspect, Math.round((4 / 3) * 10000) / 10000);
  assert.equal(sanitizeHeroVideo({ ...base, aspect: "1.7778" }).aspect, 1.7778);
  for (const junk of [0, -2, "1e99", "nope", Infinity, 100, 0.1]) {
    assert.ok(!("aspect" in sanitizeHeroVideo({ ...base, aspect: junk })), String(junk));
  }
  // Playlist/channel blocks can carry an aspect too (harmless), unknown = omitted:
  assert.ok(!("aspect" in sanitizeHeroVideo({ kind: "playlist", playlistId: LIST })));
});

test("hasHeroVideo reflects playability", () => {
  assert.equal(hasHeroVideo(EMPTY_HERO_VIDEO), false);
  assert.equal(hasHeroVideo(undefined), false);
  assert.equal(hasHeroVideo({ kind: "video", videoId: VID }), true);
  assert.equal(hasHeroVideo({ kind: "playlist", playlistId: LIST }), true);
  assert.equal(hasHeroVideo({ kind: "channel", playlistId: UPLOADS }), true);
  assert.equal(hasHeroVideo({ kind: "channel", playlistId: "" }), false);
});

test("coverSize crops in-player bars: the video region always covers the container", async () => {
  const { coverSize, FRAME_ASPECT } = await import("../lib/media/youtube.js");

  const cases = [
    // [containerW, containerH, aspect]
    [1600, 900, 16 / 9],   // 16:9 hero, 16:9 video → exact fit
    [1600, 900, 4 / 3],    // desktop hero, 4:3 classic → pillarbox cropped
    [390, 844, 16 / 9],    // mobile portrait, 16:9 video
    [390, 844, 4 / 3],     // mobile portrait, 4:3
    [1600, 900, 9 / 16],   // desktop hero, vertical short
    [1600, 900, 2.4],      // ultrawide cinema → letterbox cropped
    [520, 440, 0]          // split media frame, unknown aspect (defaults 16:9)
  ];

  for (const [w, h, a] of cases) {
    const { width, height } = coverSize(w, h, a);
    const aspect = a > 0 ? a : FRAME_ASPECT;
    // The frame is 16:9:
    assert.ok(Math.abs(width / height - FRAME_ASPECT) < 0.01, `frame aspect ${w}x${h}@${a}`);
    // The video region inside that frame (contain-fit) covers the container:
    const videoW = Math.min(width, height * aspect);
    const videoH = videoW / aspect;
    assert.ok(videoW >= w - 1, `videoW ${videoW} covers ${w} (@${a})`);
    assert.ok(videoH >= h - 1, `videoH ${videoH} covers ${h} (@${a})`);
  }

  // 16:9 content on a 16:9 container is NOT oversized (no needless crop):
  const exact = coverSize(1600, 900, 16 / 9);
  assert.ok(exact.width <= 1601 && exact.height <= 901);
});

test("coverSize verticalBleed overflows the container top/bottom to hide edge chrome", async () => {
  const { coverSize, FRAME_ASPECT } = await import("../lib/media/youtube.js");
  const BLEED = 0.12;

  const cases = [
    [1600, 900, 16 / 9],
    [1600, 900, 4 / 3],
    [390, 844, 16 / 9],
    [1600, 900, 2.4],
    [520, 440, 0]
  ];

  for (const [w, h, a] of cases) {
    const { width, height } = coverSize(w, h, a, BLEED);
    const aspect = a > 0 ? a : FRAME_ASPECT;
    // Still a 16:9 frame:
    assert.ok(Math.abs(width / height - FRAME_ASPECT) < 0.01, `frame aspect ${w}x${h}@${a}`);
    // The video region covers the bleed-inflated box, so the centered iframe
    // overflows the container by >= bleed × height on top AND bottom:
    const videoW = Math.min(width, height * aspect);
    const videoH = videoW / aspect;
    assert.ok(videoW >= w - 1, `videoW ${videoW} covers ${w} (@${a})`);
    assert.ok(videoH >= h * (1 + 2 * BLEED) - 1, `videoH ${videoH} covers inflated ${h} (@${a})`);
    assert.ok(height >= h * (1 + 2 * BLEED) - 1, `frame ${height} overflows container ${h} (@${a})`);
  }

  // bleed=0 (and omitted / invalid) is byte-identical to the old behavior:
  assert.deepEqual(coverSize(1600, 900, 4 / 3, 0), coverSize(1600, 900, 4 / 3));
  assert.deepEqual(coverSize(1600, 900, 4 / 3, -1), coverSize(1600, 900, 4 / 3));
  assert.deepEqual(coverSize(1600, 900, 4 / 3, NaN), coverSize(1600, 900, 4 / 3));
});
