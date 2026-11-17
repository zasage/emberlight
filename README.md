# Emberlight — Keeper of the Last Lantern

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/zasage/emberlight/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/zasage/emberlight/reward.svg)](https://make.fun/bounty/best-game-01)

A 2D canvas arena survival game. You are the keeper of the last lantern in a
world gone dark. Shadows crawl in from the edges of the arena; your lantern's
light is the only thing that burns them back. Gather the embers they drop,
spend them on upgrades between waves, and hold the light through all 8 waves.

## How to play

- **Move** — WASD or the arrow keys. The keeper follows where you point.
- **Aim** — the mouse. Your lantern shines toward the cursor.
- **Light pulse** — click, or press Space. A burst of light that scorches
  nearby shadows; it needs a moment to recharge.
- **Pause** — P. **Mute** — M.

Shadows destroyed by light drop embers. Pick them up — between waves you can
trade embers for a stronger lantern, a faster pulse, or quicker feet. Survive
all 8 waves to win; if the lantern's flame goes out, the dark takes the arena.

## Running it

Play-test locally (no install, Node 22+ is enough):

```sh
node serve.ts
# open http://localhost:8080/ in a desktop browser
```

Build the bounty entry (copies `game/` and `screenshots/` into the output
directory and writes `dossier.json` beside them):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`MAKEFUN_OUTPUT_DIR` defaults to `/output` when it is not set.

## Technical notes

- The game is plain static files under `game/` — `index.html` plus its own
  scripts, styles and assets — with no network requests and no dependencies,
  so it loads offline in any desktop browser.
- `main.ts` is the entry builder: it copies `game/` and `screenshots/` into
  the output directory and calls `buildDossier` from
  `vendor/makefun-game.ts` to produce `dossier.json`.
- `serve.ts` is a small static file server (Node standard library only) for
  local play-testing on port 8080.
- `shots.json` lists the four screenshots the entry ships, each with the
  query string that puts the game into the shot's state.
