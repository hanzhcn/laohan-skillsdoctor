import fs from "fs";
import path from "path";
import { PATHS } from "./paths";
import type {
  Skill,
  LockEntry,
  PluginEntry,
  PathInfo,
  ScanResult,
  Origin,
} from "./types";
import { classify } from "./classify";
import { checkHealth } from "./health";

function readJSON<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function pathInfo(p: string): PathInfo {
  let lstat: fs.Stats | null = null;
  try {
    lstat = fs.lstatSync(p);
  } catch {
    /* not present */
  }
  if (!lstat) return { state: "absent", exists: false };
  if (lstat.isSymbolicLink()) {
    let target: string | undefined;
    try {
      target = fs.readlinkSync(p);
    } catch {
      /* ignore */
    }
    const abs = target ? path.resolve(path.dirname(p), target) : undefined;
    return {
      state: "symlink",
      target: abs,
      exists: abs ? fs.existsSync(abs) : false,
    };
  }
  return { state: "real", exists: true };
}

function readLock(): Map<string, LockEntry> {
  const m = new Map<string, LockEntry>();
  const d = readJSON<{ skills: Record<string, LockEntry> }>(PATHS.lockFile);
  if (d?.skills) for (const [k, v] of Object.entries(d.skills)) m.set(k, v);
  return m;
}

function readPlugins(): Map<string, PluginEntry> {
  const m = new Map<string, PluginEntry>();
  const d = readJSON<{
    plugins: Record<
      string,
      Array<{ installPath: string; version: string; gitCommitSha?: string }>
    >;
  }>(PATHS.pluginsFile);
  if (d?.plugins) {
    for (const [key, entries] of Object.entries(d.plugins)) {
      const e = entries[0];
      if (!e?.installPath) continue;
      const skillsDir = path.join(e.installPath, "skills");
      if (!fs.existsSync(skillsDir)) continue;
      let names: string[] = [];
      try {
        names = fs.readdirSync(skillsDir);
      } catch {
        /* ignore */
      }
      for (const n of names) {
        try {
          if (
            fs.statSync(path.join(skillsDir, n)).isDirectory() &&
            !m.has(n)
          ) {
            m.set(n, {
              plugin: key,
              installPath: e.installPath,
              version: e.version,
              gitCommitSha: e.gitCommitSha,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
  return m;
}

function listDir(p: string): string[] {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .map((d) => d.name)
      .filter((n) => !n.startsWith("."));
  } catch {
    return [];
  }
}

function summarize(skills: Skill[]): ScanResult["summary"] {
  const byOrigin: Record<Origin, number> = {
    "self-laohan": 0,
    "self-cheat": 0,
    dbskill: 0,
    "tool-managed": 0,
    openclaw: 0,
    npx: 0,
    plugin: 0,
    orphan: 0,
  };
  const healthIssues = {
    duplicateCopy: 0,
    drift: 0,
    dangling: 0,
    dualEntity: 0,
    notInCC: 0,
    brokenLink: 0,
  };
  for (const s of skills) {
    byOrigin[s.origin]++;
    if (s.health.duplicateCopy) healthIssues.duplicateCopy++;
    if (s.health.drift) healthIssues.drift++;
    if (s.health.dangling) healthIssues.dangling++;
    if (s.health.dualEntity) healthIssues.dualEntity++;
    if (s.health.notInCC) healthIssues.notInCC++;
    if (s.health.brokenLink) healthIssues.brokenLink++;
  }
  return { byOrigin, healthIssues, total: skills.length };
}

export function scan(): ScanResult {
  const lock = readLock();
  const plugins = readPlugins();
  const names = new Set<string>([
    ...listDir(PATHS.agentsSkills),
    ...listDir(PATHS.claudeSkills),
    ...lock.keys(),
    ...plugins.keys(), // 含插件自带 skill（ECC/claude-mem/waza 等），让"插件"来源可见
  ]);
  const skills: Skill[] = [];
  for (const name of names) {
    // 过滤无 SKILL.md 的目录（框架目录如 adapters/learned 不是真 skill）
    const hasSkill =
      fs.existsSync(path.join(PATHS.agentsSkills, name, "SKILL.md")) ||
      fs.existsSync(path.join(PATHS.claudeSkills, name, "SKILL.md")) ||
      plugins.has(name);
    if (!hasSkill) continue;
    const agents = pathInfo(path.join(PATHS.agentsSkills, name));
    const claude = pathInfo(path.join(PATHS.claudeSkills, name));
    const codex = pathInfo(path.join(PATHS.codexSkills, name));
    const lockEntry = lock.get(name);
    const pluginEntry = plugins.get(name);
    const { origin, originDetail } = classify(
      name,
      agents,
      claude,
      lockEntry,
      pluginEntry,
    );
    const health = checkHealth(name, agents, claude, origin, pluginEntry);
    skills.push({
      name,
      agents,
      claude,
      codex,
      origin,
      originDetail,
      lock: lockEntry,
      plugin: pluginEntry,
      health,
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { skills, summary: summarize(skills) };
}
