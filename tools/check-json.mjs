import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", "node_modules", ".obsidian", "dist", "backups"]);
const failures = [];
let checked = 0;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      checked += 1;
      try { JSON.parse(await readFile(fullPath, "utf8")); }
      catch (error) { failures.push(`${path.relative(root, fullPath)}: ${error.message}`); }
    }
  }
}
await walk(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`check-json: ${checked} JSON file(s) parsed successfully`);
}
