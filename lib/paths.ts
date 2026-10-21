import path from "path"
import os from "os"

const HOME = os.homedir()

export const PATHS = {
  agentsSkills: path.join(HOME, ".agents", "skills"),
  claudeSkills: path.join(HOME, ".claude", "skills"),
  lockFile: path.join(HOME, ".agents", ".skill-lock.json"),
  pluginsFile: path.join(HOME, ".claude", "plugins", "installed_plugins.json"),
  laohanRepo: path.join(HOME, "Documents", "laohan-skills"),
  cheatRepo: path.join(HOME, "Documents", "cheat-on-content", "skills"),
  dbsRepo: path.join(HOME, "Documents", "dbskill", "skills"),
  openclawSkills: path.join(HOME, ".openclaw", "skills"),
  codexSkills: path.join(HOME, ".codex", "skills"),
} as const
