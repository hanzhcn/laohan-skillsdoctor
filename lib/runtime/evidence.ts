import type { CallEvidence, RuntimeSkill, RuntimeRow, SeenEvidence, ValidationReceipt } from "./types.ts";

export function isValidationReceipt(value: unknown): value is ValidationReceipt {
  if (!value || typeof value !== "object") return false;
  const r = value as ValidationReceipt;
  const v = r.validator;
  return r.schemaVersion === 1 && ["claude", "codex"].includes(r.host) &&
    [r.skillPath, r.sessionId, r.callId, r.scenario].every(x => typeof x === "string" && x.trim().length > 0) &&
    /^[a-f0-9]{64}$/.test(r.documentSha256) && !!v && typeof v.name === "string" && !!v.name.trim() &&
    [v.commandSha256, v.stdoutSha256, v.stderrSha256].every(x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x)) &&
    typeof v.timedOut === "boolean" && (v.exitCode === null || Number.isInteger(v.exitCode)) &&
    typeof v.startedAt === "string" && typeof v.finishedAt === "string";
}

export function callBindsVersion(skill: RuntimeSkill, call: CallEvidence): boolean {
  return call.host === skill.host && call.outcome === "loaded" &&
    call.skillPath === skill.path && call.bodySha256 === skill.bodySha256 &&
    Number.isFinite(Date.parse(skill.modifiedAt)) && Date.parse(skill.modifiedAt) <= Date.parse(call.at);
}

export function buildRuntimeRows(
  skills: RuntimeSkill[], calls: CallEvidence[], seen: SeenEvidence[],
  receipts: ValidationReceipt[], now = new Date(),
): RuntimeRow[] {
  const rows: RuntimeRow[] = skills.map(s => ({ ...s, calls: [], ambiguousCalls: 0,
    effectiveness: { state: "unverified", detail: "尚无关联该版本和调用的场景验收记录；加载成功不等于结果有效。" } }));
  const unique = new Map<string, CallEvidence>();
  const rank = { pending: 0, returned: 1, loaded: 2, error: 3 };
  for (const c of calls) {
    const key = `${c.host}:${c.sessionId}:${c.callId}`;
    const previous = unique.get(key);
    if (!previous || rank[c.outcome] > rank[previous.outcome]) unique.set(key, c);
  }
  for (const c of unique.values()) {
    const candidates = rows.filter(r => r.host === c.host &&
      (c.skillPath ? r.path === c.skillPath : r.names.includes(c.name)));
    if (candidates.length === 1) candidates[0].calls.push(c);
    else for (const r of candidates) r.ambiguousCalls++;
  }
  for (const row of rows) {
    row.calls.sort((a, b) => b.at.localeCompare(a.at));
    row.lastSeen = seen.filter(s => s.host === row.host && s.path === row.path)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const applicable = receipts.filter(r => isValidationReceipt(r) && r.host === row.host && r.skillPath === row.path)
      .filter(r => {
        const start = Date.parse(r.validator.startedAt), end = Date.parse(r.validator.finishedAt);
        const call = row.calls.find(c => c.sessionId === r.sessionId && c.callId === r.callId);
        return call && Number.isFinite(start) && Number.isFinite(end) &&
          end >= start && end <= now.getTime() && start >= Date.parse(call.at);
      }).sort((a, b) => Date.parse(b.validator.finishedAt) - Date.parse(a.validator.finishedAt));
    const latest = applicable[0];
    if (!latest) continue;
    if (latest.documentSha256 !== row.sha256) {
      row.effectiveness = { state: "stale", detail: "技能文件已变化，旧场景验收不适用于当前版本。", receipt: latest };
      continue;
    }
    const call = row.calls.find(c => c.sessionId === latest.sessionId && c.callId === latest.callId)!;
    if (!callBindsVersion(row, call)) continue;
    const passed = latest.validator.exitCode === 0 && !latest.validator.timedOut;
    row.effectiveness = { state: passed ? "passed" : "failed",
      detail: passed ? "该版本的一次指定场景验收命令通过；不代表所有任务都有效。" : "该版本最近一次关联场景验收失败或超时。", receipt: latest };
  }
  return rows;
}
