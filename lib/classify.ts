import type { Origin, PathInfo, LockEntry, PluginEntry } from "./types";

/**
 * 来源分类（按优先级）。规则权威规格见 ~/.claude/rules/skills.md v1.3。
 * symlink 目标优先于 lock/plugin —— 自研 skill 通过 symlink 指向 git 仓库。
 */
export function classify(
  name: string,
  agents: PathInfo,
  claude: PathInfo,
  lock?: LockEntry,
  plugin?: PluginEntry,
): { origin: Origin; originDetail?: { source?: string; plugin?: string; repo?: string } } {
  const targets = [agents.target, claude.target].filter(Boolean) as string[];
  for (const t of targets) {
    if (t.includes("Documents/laohan-skills"))
      return { origin: "self-laohan", originDetail: { repo: "laohan-skills" } };
    if (t.includes("cheat-on-content"))
      return { origin: "self-cheat", originDetail: { repo: "cheat-on-content" } };
    if (t.includes(".openclaw/skills"))
      return { origin: "openclaw", originDetail: { repo: "openclaw" } };
  }
  if (lock)
    return { origin: "npx", originDetail: { source: lock.source } };
  if (plugin)
    return { origin: "plugin", originDetail: { plugin: plugin.plugin } };
  return { origin: "orphan" };
}
