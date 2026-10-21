import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { Health, PathInfo, Origin, PluginEntry } from "./types";
import { PATHS } from "./paths";
import { repoForOrigin, GOVERNED_SKILLS } from "./classify";

function diffLineCount(a: string, b: string): number {
  try {
    const out = execSync(`diff ${JSON.stringify(a)} ${JSON.stringify(b)}`, {
      encoding: "utf-8",
    });
    return out
      .split("\n")
      .filter((l) => l.startsWith("<") || l.startsWith(">")).length;
  } catch (e: unknown) {
    // diff exits non-zero when files differ but still writes diff to stdout
    const out = (e as { stdout?: string }).stdout;
    if (out)
      return out
        .split("\n")
        .filter((l) => l.startsWith("<") || l.startsWith(">")).length;
    return 0;
  }
}

/** 自研 skill 对应的 git 仓 SKILL.md 路径（治理仓实体/仓库无此 skill 时为 null） */
function repoSkillPath(name: string, origin: Origin): string | null {
  const repo = repoForOrigin(origin);
  if (!repo) return null;
  const p = path.join(repo, name, "SKILL.md");
  return fs.existsSync(p) ? p : null;
}

/** 实体副本形态 = 规范要求的"symlink→git 仓"链路断裂 */
function isBrokenLink(name: string, origin: Origin, agents: PathInfo): boolean {
  if (agents.state !== "real") return false;
  if (origin !== "self-laohan" && origin !== "self-cheat") return false;
  if (origin === "self-laohan" && GOVERNED_SKILLS.has(name)) return false;
  // 自研 skill 规范要求 agents 侧为 symlink→git 仓；实体存在 = 链断
  return true;
}

export function checkHealth(
  name: string,
  agents: PathInfo,
  claude: PathInfo,
  origin: Origin,
  plugin?: PluginEntry,
): Health {
  const h: Health = {};

  // dangling symlink
  if (
    (agents.state === "symlink" && !agents.exists) ||
    (claude.state === "symlink" && !claude.exists)
  ) {
    h.dangling = true;
  }

  // dual entity (agents + claude both real dirs → drift-prone)
  if (agents.state === "real" && claude.state === "real") {
    h.dualEntity = true;
  }

  // not in CC (agents has it, claude doesn't → CC can't see it)
  if (agents.state !== "absent" && claude.state === "absent") {
    h.notInCC = true;
  }

  // brokenLink：自研 skill 实体副本，repo 存在的同名 skill 未通过 symlink 接链
  if (isBrokenLink(name, origin, agents)) h.brokenLink = true;

  // duplicate copy (local has real/symlink + plugin has same name → compare)
  if (plugin) {
    const pluginSkill = path.join(plugin.installPath, "skills", name, "SKILL.md");
    const localSkill = path.join(PATHS.agentsSkills, name, "SKILL.md");
    if (fs.existsSync(pluginSkill) && fs.existsSync(localSkill)) {
      const identical =
        fs.readFileSync(pluginSkill, "utf-8") ===
        fs.readFileSync(localSkill, "utf-8");
      h.duplicateCopy = { plugin: plugin.plugin, identical };
    }
  }

  // drift：实体副本 vs git 仓库真身（symlink 形态本就指向仓库，无需比）
  const repoSkill = repoSkillPath(name, origin);
  if (repoSkill && agents.state === "real") {
    const localSkill = path.join(PATHS.agentsSkills, name, "SKILL.md");
    if (fs.existsSync(localSkill)) {
      const dl = diffLineCount(localSkill, repoSkill);
      if (dl > 0) h.drift = { repo: repoSkill, diffLines: dl };
    }
  }

  return h;
}

/** build drift diff text for detail view */
export function driftDiff(name: string, origin: Origin): string | null {
  const repoSkill = repoSkillPath(name, origin);
  if (!repoSkill) return null;
  const localSkill = path.join(PATHS.agentsSkills, name, "SKILL.md");
  if (!fs.existsSync(localSkill)) return null;
  try {
    return execSync(`diff ${JSON.stringify(localSkill)} ${JSON.stringify(repoSkill)}`, {
      encoding: "utf-8",
    });
  } catch (e: unknown) {
    return (e as { stdout?: string }).stdout ?? null;
  }
}
