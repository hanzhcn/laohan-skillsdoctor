import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import type { Health, PathInfo, Origin, PluginEntry } from "./types";
import { PATHS } from "./paths";
import { repoForOrigin } from "./classify";

/**
 * notInCC 抑制名单：这些 skill 有意不桥接 CC，不算健康问题。
 * 内置规则：source-command-*（自述"迁移来源参考，宿主能力未验证"的参考材料，
 * 且与 ECC 命令大面积重复，桥接只会污染 CC 列表——2026-10-21 拍板不桥）。
 * 外部名单：~/.agents/.skd-ignore-notcc 一行一个 skill 名，可自行增删。
 */
const NOTCC_BUILTIN_PREFIXES = ["source-command-"];

function loadNotccIgnore(): Set<string> {
  const s = new Set<string>();
  try {
    const lines = fs
      .readFileSync(path.join(os.homedir(), ".agents", ".skd-ignore-notcc"), "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const l of lines) s.add(l);
  } catch {
    /* 文件不存在 = 无外部名单 */
  }
  return s;
}

function isNotccSuppressed(name: string, ignoreList: Set<string>): boolean {
  if (ignoreList.has(name)) return true;
  return NOTCC_BUILTIN_PREFIXES.some((p) => name.startsWith(p));
}

function diffLineCount(a: string, b: string): number {
  try {
    const out = execFileSync("diff", ["--", a, b], {
      encoding: "utf-8",
    });
    return out
      .split("\n")
      .filter((l) => l.startsWith("<") || l.startsWith(">")).length;
  } catch (e: unknown) {
    // diff exits non-zero when files differ but still writes diff to stdout
    const out = (e as { stdout?: string }).stdout;
    if ((e as { status?: number }).status === 1 && out)
      return out
        .split("\n")
        .filter((l) => l.startsWith("<") || l.startsWith(">")).length;
    throw new Error("文件差异检查未成功完成，不能判定无漂移");
  }
}

/** 自研 skill 对应的 git 仓 SKILL.md 路径（治理仓实体/仓库无此 skill 时为 null） */
function repoSkillPath(name: string, origin: Origin): string | null {
  const repo = repoForOrigin(origin);
  if (!repo) return null;
  const p = path.join(repo, name, "SKILL.md");
  return fs.existsSync(p) ? p : null;
}

/** brokenLink = 该 symlink 到 git 仓却以实体存在（agents 实体 + git 仓同名并存 = 双份漂移源）。
 *  治理真身（真身在治理仓、git 仓无同名）是规范形态，不报。 */
function isBrokenLink(name: string, origin: Origin, agents: PathInfo): boolean {
  if (agents.state !== "real") return false;
  if (origin !== "self-laohan" && origin !== "self-cheat") return false;
  return repoSkillPath(name, origin) !== null;
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
  // 有意不桥接的（source-command-* 参考材料 / 外部抑制名单）不算健康问题
  if (agents.state !== "absent" && claude.state === "absent") {
    if (!isNotccSuppressed(name, loadNotccIgnore())) h.notInCC = true;
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
    return execFileSync("diff", ["--", localSkill, repoSkill], {
      encoding: "utf-8",
    });
  } catch (e: unknown) {
    if ((e as { status?: number }).status === 1) return (e as { stdout?: string }).stdout ?? null;
    throw new Error("文件差异详情读取失败");
  }
}
