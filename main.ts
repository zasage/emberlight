// Emberlight — entry point for the make.fun best-game-01 bounty.
//
// What this program does, in order:
//   1. Works out where the entry should be assembled (MAKEFUN_OUTPUT_DIR,
//      defaulting to /output).
//   2. Copies the playable game (game/) and its screenshots (screenshots/)
//      from beside this file into that output directory.
//   3. Asks the vendored dossier library to describe the assembled entry
//      and writes the result as dossier.json next to the copies.
//
// Run it with plain Node 22+ — no build step, no dependencies:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-game.ts';

// The caps the bounty gate hands the dossier builder. game_max_files is 993
// rather than 1000 on purpose: the grader counts the output directory itself
// at 1000 entries, and game/ plus screenshots/ plus dossier.json already take
// seven of those slots.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  // Make sure the output directory exists before anything lands in it.
  mkdirSync(outDir, { recursive: true });

  // Bring the entry's two payloads over, exactly as they sit in the repo.
  for (const name of ['game', 'screenshots']) {
    cpSync(join(here, name), join(outDir, name), { recursive: true });
  }

  // Describe the assembled entry and write the dossier beside the copies.
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
