import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SKILLS_DIR = join(__dirname, "..", "..", "skills");
const OUTPUT = join(__dirname, "..", "public", "skills.json");

function parseFrontMatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[key] = val;
  }
  return { meta, body: match[2] };
}

async function listFiles(dir, base = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      files.push({ name: e.name, path: rel, type: "dir" });
      files.push(...(await listFiles(join(dir, e.name), rel)));
    } else {
      files.push({ name: e.name, path: rel, type: "file" });
    }
  }
  return files;
}

async function buildManifest() {
  console.log("Scanning skills directory:", SKILLS_DIR);
  const dirs = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];

  for (const d of dirs.filter((d) => d.isDirectory())) {
    const skillDir = join(SKILLS_DIR, d.name);
    const skillPath = `skills/${d.name}`;
    console.log(`  Processing: ${d.name}`);

    // Parse SKILL.md
    let meta = {}, body = "";
    try {
      const raw = await readFile(join(skillDir, "SKILL.md"), "utf-8");
      const parsed = parseFrontMatter(raw);
      meta = parsed.meta;
      body = parsed.body;
    } catch {
      console.log(`    No SKILL.md found, skipping`);
      continue;
    }

    // List all files
    const allFiles = await listFiles(skillDir);
    const fileTree = allFiles.map((f) => ({
      name: f.name,
      path: `${skillPath}/${f.path}`,
      type: f.type,
    }));

    skills.push({
      name: d.name,
      meta,
      body,
      files: fileTree,
      fileCount: allFiles.filter((f) => f.type === "file").length,
    });
  }

  const manifest = { generatedAt: new Date().toISOString(), skills };
  writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${OUTPUT}`);
  console.log(`Total skills: ${skills.length}`);
}

buildManifest().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
