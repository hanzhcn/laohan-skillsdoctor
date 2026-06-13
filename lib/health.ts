import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { Health, PathInfo, Origin, PluginEntry } from "./types";
import { PATHS } from "./paths";

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

  // drift (self-laohan agents vs git repo)
  if (origin === "self-laohan") {
    const repoSkill = path.join(PATHS.laohanRepo, name, "SKILL.md");
    const localSkill = path.join(PATHS.agentsSkills, name, "SKILL.md");
    if (fs.existsSync(repoSkill) && fs.existsSync(localSkill)) {
      const dl = diffLineCount(localSkill, repoSkill);
      if (dl > 0) h.drift = { repo: PATHS.laohanRepo, diffLines: dl };
    }
  }

  return h;
}

/** build drift diff text for detail view */
export function driftDiff(name: string): string | null {
  const repoSkill = path.join(PATHS.laohanRepo, name, "SKILL.md");
  const localSkill = path.join(PATHS.agentsSkills, name, "SKILL.md");
  if (!fs.existsSync(repoSkill) || !fs.existsSync(localSkill)) return null;
  try {
    return execSync(`diff ${JSON.stringify(localSkill)} ${JSON.stringify(repoSkill)}`, {
      encoding: "utf-8",
    });
  } catch (e: unknown) {
    return (e as { stdout?: string }).stdout ?? null;
  }
}
