export type Origin =
  | "self-laohan"
  | "self-cheat"
  | "dbskill"
  | "tool-managed"
  | "governed"
  | "openclaw"
  | "npx"
  | "plugin"
  | "orphan"

export type PathState = "real" | "symlink" | "absent";

export interface LockEntry {
  source: string;
  sourceType: string;
  sourceUrl: string;
  skillPath: string;
  skillFolderHash: string;
  installedAt: string;
  updatedAt: string;
}

export interface PluginEntry {
  plugin: string; // key in installed_plugins.json, e.g. "ecc@everything-claude-code"
  installPath: string;
  version: string;
  gitCommitSha?: string;
}

export interface PathInfo {
  state: PathState;
  target?: string; // resolved absolute symlink target
  exists: boolean; // false when dangling symlink
}

export interface Health {
  duplicateCopy?: { plugin: string; identical: boolean };
  drift?: { repo: string; diffLines: number };
  dangling?: boolean;
  dualEntity?: boolean;
  notInCC?: boolean;
  brokenLink?: boolean; // 自研 skill 以实体副本存在，未按规范 symlink→git 仓库
}

export interface Skill {
  name: string;
  agents: PathInfo;
  claude: PathInfo;
  codex: PathInfo;
  openclaw: PathInfo;
  origin: Origin;
  originDetail?: { source?: string; plugin?: string; repo?: string };
  lock?: LockEntry;
  plugin?: PluginEntry;
  health: Health;
}

export interface ScanSummary {
  byOrigin: Record<Origin, number>;
  healthIssues: {
    duplicateCopy: number;
    drift: number;
    dangling: number;
    dualEntity: number;
    notInCC: number;
    brokenLink: number;
  };
  total: number;
}

export interface ScanResult {
  skills: Skill[];
  summary: ScanSummary;
}
