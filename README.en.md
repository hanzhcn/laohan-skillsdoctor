# laohan-skillsdoctor

> Formerly `skill-doctor`, renamed to `laohan-skillsdoctor` in October 2026.

> A **skill health dashboard** for Claude Code / OpenClaw — see at a glance where your skills come from and whether any are polluted, drifting, or orphaned.

[中文](./README.md) · English

## Why

After using Claude Code / OpenClaw for a while, `~/.agents/skills` and `~/.claude/skills` accumulate hundreds of skills from all directions: ones you wrote yourself, ones installed via `npx skills add`, ones bundled with plugins like ECC, ones shipped with OpenClaw… Some operation may also dump a batch of **plugin skill copies** into them (pollution), or a self-built skill's local copy may **drift both ways** against its git repo (you changed local but never pushed; the repo changed but you never pulled, so CC keeps reading the stale version).

Existing skill managers (jiweiyeah/Skills-Manager and friends) are all about "publishing to a registry" or "tagging by hand". **None of them automatically classify by source or detect pollution, drift, and orphans.** laohan-skillsdoctor turns that audit logic into a product.

## Features

- **Automatic source classification**: self-built (laohan/cheat) / npx / plugin copy / OpenClaw / orphan — clear at a glance
- **Health checks**:
  - 🔴 Dangling symlink
  - 🔴 Invisible to CC (exists under agents but missing under claude)
  - 🟡 Plugin copy (same name as a plugin skill — likely pollution)
  - 🟡 Duplicate entity (real entities under both agents and claude — a breeding ground for drift)
  - 🟡 Drift (diff between a self-built skill's local copy and its git repo)
- **Detail view**: path status, npx lockfile metadata, original plugin path, drift diff, SKILL.md preview

## Install

```bash
git clone https://github.com/hanzhcn/laohan-skillsdoctor.git
cd laohan-skillsdoctor
npm install
npm run dev
# open http://localhost:3000
```

Runs entirely locally. It scans your skills directories read-only and never modifies any file.

## Data Sources

| Source | Path |
|--------|------|
| agents real files | `~/.agents/skills/` |
| CC bridge layer | `~/.claude/skills/` |
| npx lockfile | `~/.agents/.skill-lock.json` |
| Plugin manifest | `~/.claude/plugins/installed_plugins.json` |
| Self-built git | `~/Documents/laohan-skills/` |
| cheat git | `~/Documents/cheat-on-content/skills/` |
| OpenClaw | `~/.openclaw/skills/` |

## Classification Rules

1. symlink points to `Documents/laohan-skills` → self-built laohan
2. symlink points to `cheat-on-content` → self-built cheat
3. symlink points to `.openclaw/skills` → OpenClaw
4. Recorded in `.skill-lock.json` → npx
5. Same name as some plugin's `skills/` → plugin copy
6. None of the above → orphan ⚠️

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui

## Roadmap

- [x] Read-only health check (scan / classify / health check / details)
- [ ] Write operations (delete copies / convert to symlink / sync repo, with double confirmation)
- [ ] Update detection (git fetch / skillFolderHash comparison)
- [ ] Tauri desktop packaging

## License

MIT
