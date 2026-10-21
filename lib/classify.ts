import path from "path";
import fs from "fs";
import type { Origin, PathInfo, LockEntry, PluginEntry } from "./types";
import { PATHS } from "./paths";

/**
 * 来源分类（按优先级）。规则权威规格见 ~/.claude/rules/skills.md v1.11。
 * 判定链：symlink 目标 → dbskill 仓库 → 反向链定式 → 治理仓实体/链断副本 → lock/plugin → orphan。
 */

/** 自研 skill 真身在治理仓 ~/.agents/skills 实体（非公开 git 仓）的名单 */
export const GOVERNED_SKILLS = new Set([
  "laohan-skillcreator",
  "laohan-chushihua",
  "laohan-devrules",
]);

function repoForOrigin(origin: Origin): string | null {
  if (origin === "self-laohan") return PATHS.laohanRepo;
  if (origin === "self-cheat") return PATHS.cheatRepo;
  return null;
}

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
  // 反向链定式（skills.md v1.11）：工具管理型 skill 真身在安装位，
  // agents/claude 侧 symlink 指向工具目录而非 git 仓（paseo*、ui-sketcher 等）
  for (const t of targets) {
    if (/\/\.claude\/skills\//.test(t) || /\/\.codex\/skills\//.test(t) || t.includes("paseo-plugins"))
      return { origin: "tool-managed", originDetail: { repo: t } };
  }
  // dbskill 手动复制形态：dbs-* 真身在 ~/Documents/dbskill/skills
  if (name.startsWith("dbs") && fs.existsSync(path.join(PATHS.dbsRepo, name, "SKILL.md")))
    return { origin: "dbskill", originDetail: { repo: "dbskill" } };
  // 治理仓实体：真身就是 ~/.agents/skills 实体（非公开仓、非 npx/plugin）
  if (GOVERNED_SKILLS.has(name) && agents.state === "real")
    return { origin: "self-laohan", originDetail: { repo: "治理仓实体" } };
  // 链断自研副本：按前缀认自研，但以实体形态存在（规范应为 symlink→git 仓）
  if (agents.state === "real" && claude.state !== "real") {
    if (/^laohan-/.test(name)) return { origin: "self-laohan", originDetail: { repo: "实体副本·链断" } };
    if (/^cheat-/.test(name)) return { origin: "self-cheat", originDetail: { repo: "实体副本·链断" } };
  }
  if (lock) return { origin: "npx", originDetail: { source: lock.source } };
  if (plugin) return { origin: "plugin", originDetail: { plugin: plugin.plugin } };
  return { origin: "orphan" };
}

export { repoForOrigin };
