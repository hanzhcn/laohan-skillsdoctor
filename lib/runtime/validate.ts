import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { digest } from "./catalog.ts";
import { callBindsVersion } from "./evidence.ts";
import type { CallEvidence, RuntimeSkill, ValidationReceipt } from "./types.ts";

/** Explicit CLI-only validation. The Web API never imports this command runner. */
export async function recordValidation(options: {
  skill: RuntimeSkill; call: CallEvidence; command: string[]; scenario: string; checkName: string;
  cwd: string; directory: string; timeoutMs: number;
}) {
  const { skill, call, command, scenario, checkName, cwd, directory, timeoutMs } = options;
  if (!callBindsVersion(skill, call) || !command.length || !scenario.trim() || !checkName.trim() ||
    !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000 || !Number.isFinite(Date.parse(call.at)) || Date.parse(call.at) > Date.now()) throw new Error("验收缺少有效调用、正文版本、场景或时间预算。");
  if (digest(fs.readFileSync(skill.path)) !== skill.sha256 || fs.statSync(skill.path).mtime.toISOString() !== skill.modifiedAt) throw new Error("技能在扫描后已变化，未执行验收命令。");
  const startedAt = new Date().toISOString();
  const result = await new Promise<{ exitCode: number | null; timedOut: boolean; stdoutSha256: string; stderrSha256: string; error: boolean }>(resolve => {
    const stdout = createHash("sha256"), stderr = createHash("sha256");
    const grouped = process.platform !== "win32";
    const child = spawn(command[0], command.slice(1), { cwd, shell: false, detached: grouped, stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false, error = false, bytes = 0, done = false;
    const terminate = () => {
      try { if (grouped && child.pid) process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); }
      catch { /* A process already exited. Never target an unrelated process or group. */ }
    };
    const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
    const consume = (hash: ReturnType<typeof createHash>, chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { error = true; terminate(); } else hash.update(chunk);
    };
    child.stdout.on("data", (b: Buffer) => consume(stdout, b)); child.stderr.on("data", (b: Buffer) => consume(stderr, b));
    child.on("error", () => { error = true; });
    child.on("close", code => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ exitCode: error ? null : code, timedOut, error, stdoutSha256: stdout.digest("hex"), stderrSha256: stderr.digest("hex") });
    });
  });
  const receipt: ValidationReceipt = { schemaVersion: 1, host: skill.host, skillPath: skill.path, documentSha256: skill.sha256,
    sessionId: call.sessionId, callId: call.callId, scenario: scenario.slice(0, 1000),
    validator: { name: checkName.slice(0, 120), commandSha256: digest(JSON.stringify(command)), startedAt,
      finishedAt: new Date().toISOString(), exitCode: result.exitCode, timedOut: result.timedOut,
      stdoutSha256: result.stdoutSha256, stderrSha256: result.stderrSha256 } };
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `${Date.now()}-${digest(JSON.stringify(receipt)).slice(0, 12)}.json`);
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
  let changed = true;
  try { changed = digest(fs.readFileSync(skill.path)) !== skill.sha256 || fs.statSync(skill.path).mtime.toISOString() !== skill.modifiedAt; } catch { /* Deleted during validation: cannot pass. */ }
  return { file, receipt, passed: !changed && result.exitCode === 0 && !result.timedOut && !result.error, changed };
}
