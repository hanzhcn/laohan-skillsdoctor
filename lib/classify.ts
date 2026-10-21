import path from "path";
import fs from "fs";
import type { Origin, PathInfo, LockEntry, PluginEntry } from "./types";
import { PATHS } from "./paths";

/**
 * 来源分类（按优先级）。规则权威规格见 ~/.claude/rules/skills.md v1.11。
 * 判定链：symlink 目标 → 反向链定式 → dbskill → lock → plugin →
 *         agents 实体（治理真身）→ orphan。
 * 原则：按"形态"判定，不按名字枚举——名单法天生不完备
 * （判例：glm-chat/deepseek-chat 等治理 skill 被漏报成孤儿清理候选）。
 */

function repoForOrigin(origin: Origin): string | null {
  if (origin === "self-laohan") return PATHS.laohanRepo;
  if (origin === "self-cheat") return PATHS.cheatRepo;
  return null;
}

/** claude 侧桥接是否健康：symlink 存在且指向本 skill */
function claudeBridgeOk(name: string, claude: PathInfo): boolean {
  return claude.state === "symlink" && claude.exists;
}

export function classify(
  name: string,
  agents: PathInfo,
  claude: PathInfo,
  lock?: LockEntry,
  plugin?: PluginEntry,
  openclaw?: PathInfo,
  codex?: PathInfo,
): { origin: Origin; originDetail?: { source?: string; plugin?: string; repo?: string } } {
  // 0. 单宿主独有：仅 openclaw 层存在 → openclaw 自带；仅 codex 层存在 → codex 安装位真身
  if (agents.state === "absent" && claude.state === "absent") {
    if (openclaw && openclaw.state !== "absent")
      return { origin: "openclaw", originDetail: { repo: "openclaw-独有" } };
    if (codex && codex.state !== "absent")
      return { origin: "tool-managed", originDetail: { repo: "codex-独有" } };
  }
  // 1. symlink 目标 → 自研 git 仓 / openclaw（规范形态）
  const targets = [agents.target, claude.target].filter(Boolean) as string[];
  for (const t of targets) {
    if (t.includes("Documents/laohan-skills"))
      return { origin: "self-laohan", originDetail: { repo: "laohan-skills" } };
    if (t.includes("cheat-on-content"))
      return { origin: "self-cheat", originDetail: { repo: "cheat-on-content" } };
    if (t.includes(".openclaw/skills"))
      return { origin: "openclaw", originDetail: { repo: "openclaw" } };
  }
  // 2. 反向链定式（skills.md v1.11）：工具管理型 skill 真身在安装位，
  //    agents 侧 symlink 指向工具目录而非 git 仓（paseo* 等）
  for (const t of targets) {
    if (/\/\.claude\/skills\//.test(t) || /\/\.codex\/skills\//.test(t) || t.includes("paseo-plugins"))
      return { origin: "tool-managed", originDetail: { repo: t } };
  }
  // 3. dbskill 手动复制形态：dbs-* 真身在 ~/Documents/dbskill/skills
  if (name.startsWith("dbs") && fs.existsSync(path.join(PATHS.dbsRepo, name, "SKILL.md")))
    return { origin: "dbskill", originDetail: { repo: "dbskill" } };
  // 4. lock / plugin 须在实体形态判定之前——npx 装的 skill 真身就是 agents 实体
  if (lock) return { origin: "npx", originDetail: { source: lock.source } };
  if (plugin) return { origin: "plugin", originDetail: { plugin: plugin.plugin } };
  // 5. agents 实体 = 治理真身（真身在治理仓 ~/.agents/skills，非 git 仓非 npx）。
  //    laohan-/cheat- 前缀归自研（含治理实体与公开仓真身）；其余（glm-chat、
  //    deepseek-chat 等跨模型通道）归 governed——均为正常形态，不是孤儿。
  if (agents.state === "real") {
    const bridged = claudeBridgeOk(name, claude);
    if (/^laohan-/.test(name))
      return { origin: "self-laohan", originDetail: { repo: bridged ? "治理仓实体" : "治理实体·未桥接CC" } };
    if (/^cheat-/.test(name))
      return { origin: "self-cheat", originDetail: { repo: bridged ? "治理仓实体" : "治理实体·未桥接CC" } };
    return { origin: "governed", originDetail: { repo: bridged ? "治理真身" : "治理真身·未桥接CC" } };
  }
  return { origin: "orphan" };
}

export { repoForOrigin };
