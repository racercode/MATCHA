#!/usr/bin/env node

/**
 * Seed script: reads resource folders from data/ and writes directly to Firestore.
 * Run from repo root:  node data/upload.js --all
 *
 * Requires: services/api/.env with Firebase credentials.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SUPPORTED_EXT = new Set([
  ".pdf", ".md", ".markdown", ".txt", ".html", ".htm",
  ".csv", ".xlsx", ".xls",
]);

const EXT_TO_KIND = {
  ".pdf": "pdf",
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "txt",
  ".html": "html",
  ".htm": "html",
  ".csv": "csv",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: node data/upload.js [options] [folder-name ...]

Seed gov resources from data/ folders directly into Firestore.
Requires services/api/.env with Firebase credentials.

Options:
  --all          Upload all resource folders that have metadata.json
  --dry-run      Show what would be uploaded without writing
  -h, --help     Show this help

Examples:
  node data/upload.js --all
  node data/upload.js 青年創業共享空間租賃補助作業要點
  node data/upload.js --dry-run --all`);
    process.exit(0);
  }

  const dataDir = __dirname;
  let folders = [];
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--all") {
      folders = fs
        .readdirSync(dataDir)
        .filter((f) => {
          const fullPath = path.join(dataDir, f);
          return (
            fs.statSync(fullPath).isDirectory() &&
            fs.existsSync(path.join(fullPath, "metadata.json"))
          );
        })
        .map((f) => path.join(dataDir, f));
    } else {
      const candidate = path.resolve(dataDir, args[i]);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        folders.push(candidate);
      } else {
        console.error(`Folder not found: ${args[i]}`);
        process.exit(1);
      }
    }
  }

  if (folders.length === 0) {
    console.error("No folders specified. Use --all or pass folder names. See --help.");
    process.exit(1);
  }

  console.log(`Folders: ${folders.length}`);

  if (dryRun) {
    for (const folder of folders) {
      const name = path.basename(folder);
      const meta = JSON.parse(fs.readFileSync(path.join(folder, "metadata.json"), "utf-8"));
      const files = fs
        .readdirSync(folder)
        .filter((f) => f !== "metadata.json" && SUPPORTED_EXT.has(path.extname(f).toLowerCase()));
      console.log(`\n[DRY RUN] ${name}`);
      console.log(`  rid: ${meta.rid}`);
      console.log(`  resource: ${meta.name}`);
      console.log(`  documents: ${files.join(", ") || "(none)"}`);
    }
    return;
  }

  // Build and run via tsx so we get TypeScript + ESM + dotenv from the api package
  const apiDir = path.resolve(dataDir, "../services/api");
  const tsScript = generateTsScript(folders);
  const tmpFile = path.join(apiDir, "_upload_tmp.ts");
  fs.writeFileSync(tmpFile, tsScript, "utf-8");

  try {
    console.log("Running Firestore upload...\n");
    execSync(
      `npx tsx "${tmpFile}"`,
      { cwd: apiDir, stdio: "inherit" }
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }

  console.log("\nDone.");
}

function generateTsScript(folders) {
  const folderEntries = folders.map((f) => {
    const meta = JSON.parse(fs.readFileSync(path.join(f, "metadata.json"), "utf-8"));
    const files = fs
      .readdirSync(f)
      .filter((name) => name !== "metadata.json" && SUPPORTED_EXT.has(path.extname(name).toLowerCase()))
      .map((name) => ({
        absPath: path.join(f, name).replace(/\\/g, "/"),
        filename: name,
        kind: EXT_TO_KIND[path.extname(name).toLowerCase()] || "other",
      }));
    return { meta, files };
  });

  return `
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { upsertGovernmentResource, createGovernmentResourceDocument } from './src/lib/govResourcesRepo.js'
import { extractTextFromUploadedFile } from './src/lib/documentParser.js'

const entries = ${JSON.stringify(folderEntries, null, 2)}

async function run() {
  for (const entry of entries) {
    const { meta, files } = entry
    console.log('========================================')
    console.log('Resource:', meta.name, '(' + meta.rid + ')')
    console.log('========================================')

    await upsertGovernmentResource({
      rid: meta.rid,
      agencyId: meta.agencyId || '',
      agencyName: meta.agencyName || '',
      name: meta.name,
      description: meta.description,
      eligibilityCriteria: meta.eligibilityCriteria || [],
      ...(meta.contactUrl ? { contactUrl: meta.contactUrl } : {}),
    })
    console.log('  -> Resource upserted')

    for (const file of files) {
      console.log('  -> Uploading:', file.filename)
      const buffer = await readFile(file.absPath)
      const fakeMulterFile = {
        originalname: file.filename,
        mimetype: file.kind === 'pdf' ? 'application/pdf' : 'text/plain',
        buffer: Buffer.from(buffer),
      } as any

      const extractedText = await extractTextFromUploadedFile(fakeMulterFile)
      await createGovernmentResourceDocument(meta.rid, {
        filename: file.filename,
        kind: file.kind as any,
        extractedText,
      })
      console.log('     OK (' + extractedText.length + ' chars extracted)')
    }
    console.log()
  }
}

run().then(() => { console.log('All done.'); process.exit(0) })
    .catch((err) => { console.error('FATAL:', err); process.exit(1) })
`
}

main();
