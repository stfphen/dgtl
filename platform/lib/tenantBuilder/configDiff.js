/**
 * Changed-paths diff between two tenant config snapshots. Powers the
 * before/after summary the tenant editor shows after every edit. Pure and
 * dependency-free so it unit-tests without the store.
 */

const DEFAULT_SKIP_KEYS = new Set([
  "draftConfig",
  "publishedConfig",
  "lastPublishedAt",
  "updatedAt",
  "createdAt",
  "teamId"
]);

const MAX_DISPLAY_CHARS = 140;

function truncateForDiff(value) {
  if (value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof text !== "string") return "";
  return text.length > MAX_DISPLAY_CHARS ? `${text.slice(0, MAX_DISPLAY_CHARS - 1)}…` : text;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walk(before, after, path, changes, skipKeys) {
  if (Object.is(before, after)) return;

  const bothObjects = isPlainObject(before) && isPlainObject(after);
  const bothArrays = Array.isArray(before) && Array.isArray(after);

  if (bothObjects) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (!path && skipKeys.has(key)) continue;
      walk(before[key], after[key], path ? `${path}.${key}` : key, changes, skipKeys);
    }
    return;
  }

  if (bothArrays) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      walk(before[index], after[index], `${path}.${index}`, changes, skipKeys);
    }
    return;
  }

  // Primitive change, type change, or add/remove.
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  changes.push({
    path,
    before: truncateForDiff(before),
    after: truncateForDiff(after)
  });
}

/**
 * @returns {Array<{path: string, before: string, after: string}>}
 */
export function diffConfigs(before, after, { skipKeys } = {}) {
  const changes = [];
  const skip = skipKeys ? new Set(skipKeys) : DEFAULT_SKIP_KEYS;
  walk(before || {}, after || {}, "", changes, skip);
  return changes;
}
