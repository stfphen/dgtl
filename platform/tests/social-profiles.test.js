import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySocialUrl,
  extractHandle,
  normalizeSocialUrl
} from "../lib/enrichment/socialProfiles.js";

test("social profile helpers normalize, classify, and extract handles for supported platforms", () => {
  const cases = [
    {
      input: "https://www.instagram.com/exampledental/?hl=en",
      platform: "instagram",
      normalized: "https://instagram.com/exampledental",
      handle: "@exampledental"
    },
    {
      input: "https://m.facebook.com/exampledental/",
      platform: "facebook",
      normalized: "https://facebook.com/exampledental",
      handle: "exampledental"
    },
    {
      input: "https://www.linkedin.com/company/example-dental/",
      platform: "linkedin",
      normalized: "https://linkedin.com/company/example-dental",
      handle: "company/example-dental"
    },
    {
      input: "https://twitter.com/intent/user?screen_name=exampledental",
      platform: "x",
      normalized: "https://x.com/exampledental",
      handle: "@exampledental"
    },
    {
      input: "https://www.youtube.com/@exampledental?si=abc",
      platform: "youtube",
      normalized: "https://youtube.com/@exampledental",
      handle: "@exampledental"
    },
    {
      input: "https://www.tiktok.com/@exampledental?lang=en",
      platform: "tiktok",
      normalized: "https://tiktok.com/@exampledental",
      handle: "@exampledental"
    },
    {
      input: "https://bsky.app/profile/exampledental.bsky.social",
      platform: "bluesky",
      normalized: "https://bsky.app/profile/exampledental.bsky.social",
      handle: "exampledental.bsky.social"
    },
    {
      input: "https://www.reddit.com/u/exampledental/",
      platform: "reddit",
      normalized: "https://reddit.com/u/exampledental",
      handle: "u/exampledental"
    }
  ];

  for (const testCase of cases) {
    assert.equal(classifySocialUrl(testCase.input), testCase.platform);
    assert.equal(normalizeSocialUrl(testCase.input), testCase.normalized);
    assert.equal(extractHandle(testCase.platform, testCase.input), testCase.handle);
  }
});

test("share or content URLs are ignored instead of treated as official profiles", () => {
  const invalidUrls = [
    "https://instagram.com/p/ABC123",
    "https://facebook.com/sharer.php?u=https%3A%2F%2Fexample.com",
    "https://youtube.com/watch?v=abc123",
    "https://reddit.com/comments/abc123/example_post",
    "https://x.com/share?text=hello"
  ];

  for (const value of invalidUrls) {
    assert.equal(classifySocialUrl(value), null);
    assert.equal(normalizeSocialUrl(value), null);
  }
});
