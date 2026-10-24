export type RuntimeHost = "claude" | "codex";

export interface RuntimeSkill {
  id: string;
  host: RuntimeHost;
  name: string;
  names: string[];
  path: string;
  sha256: string;
  bodySha256: string;
  modifiedAt: string;
  aliases: string[];
  source: string;
  configured: "available" | "disabled" | "unknown";
  catalog: "listed" | "disabled" | "not-listed" | "unverified";
  manualOnly: boolean;
}

export interface CallEvidence {
  host: RuntimeHost;
  sessionId: string;
  callId: string;
  name: string;
  kind: "skill" | "read";
  at: string;
  file: string;
  line: number;
  outcome: "loaded" | "error" | "returned" | "pending";
  skillPath?: string;
  bodySha256?: string;
}

export interface SeenEvidence {
  host: RuntimeHost;
  path: string;
  at: string;
  sessionId: string;
  file: string;
  line: number;
}

export interface Coverage {
  since: string;
  until: string;
  filesFound: number;
  filesRead: number;
  bytesRead: number;
  malformedLines: number;
  complete: boolean;
  issues: string[];
  roots: string[];
}

export interface LogEvidence {
  calls: CallEvidence[];
  seen: SeenEvidence[];
  coverage: Coverage;
}

export interface ValidationReceipt {
  schemaVersion: 1;
  host: RuntimeHost;
  skillPath: string;
  documentSha256: string;
  sessionId: string;
  callId: string;
  scenario: string;
  validator: {
    name: string;
    commandSha256: string;
    startedAt: string;
    finishedAt: string;
    exitCode: number | null;
    timedOut: boolean;
    stdoutSha256: string;
    stderrSha256: string;
  };
}

export interface RuntimeRow extends RuntimeSkill {
  lastSeen?: SeenEvidence;
  calls: CallEvidence[];
  ambiguousCalls: number;
  effectiveness: {
    state: "passed" | "failed" | "stale" | "unverified";
    detail: string;
    receipt?: ValidationReceipt;
  };
}

export interface CatalogProbe {
  state: "ok" | "error";
  at: string;
  cwd: string;
  skills: { name: string; path: string; enabled: boolean; description?: string }[];
  issues: string[];
}

export interface RuntimeReport {
  at: string;
  cwd: string;
  rows: RuntimeRow[];
  coverage: Coverage;
  codex: Omit<CatalogProbe, "skills"> & { listed: number; disabled: number };
  issues: string[];
  summary: { total: number; listed: number; called: number; loaded: number; failed: number; validated: number; stale: number; unverified: number };
}
