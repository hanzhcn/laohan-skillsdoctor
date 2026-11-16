import path from "node:path";
import os from "node:os";
import { canonical } from "../lib/runtime/catalog.ts";
import { scanRuntime } from "../lib/runtime/scan.ts";
import { callBindsVersion } from "../lib/runtime/evidence.ts";
import { recordValidation } from "../lib/runtime/validate.ts";

// This CLI is deliberately separate from the read-only Web API. No model calls or shell expansion.
async function main() {
  const args = process.argv.slice(2), separator = args.indexOf("--");
  if (args.includes("--help") || separator < 0) {
    console.log('用法：npm run verify:skill -- --skill /绝对路径/SKILL.md --host claude --session 会话ID --call 调用ID --scenario "具体验收场景" --check-name "检查名称" [--timeout-seconds 60] -- 可执行程序 参数...');
    if (!args.includes("--help")) process.exitCode = 1;
    return;
  }
  const values = new Map<string, string>();
  const supported = new Set(["--skill", "--host", "--session", "--call", "--scenario", "--check-name", "--timeout-seconds"]);
  for (let i = 0; i < separator; i += 2) {
    if (!supported.has(args[i]) || !args[i + 1] || values.has(args[i])) throw new Error("参数无效或重复。");
    values.set(args[i], args[i + 1]);
  }
  for (const key of ["--skill", "--host", "--session", "--call", "--scenario", "--check-name"]) if (!values.get(key)?.trim()) throw new Error(`缺少 ${key}`);
  const filename = values.get("--skill")!, host = values.get("--host")!;
  const command = args.slice(separator + 1), timeout = Number(values.get("--timeout-seconds") ?? 60);
  if (!path.isAbsolute(filename) || !["claude", "codex"].includes(host) || !command.length || !Number.isFinite(timeout) || timeout < 1 || timeout > 300) throw new Error("技能必须是绝对路径、宿主须支持，命令非空，超时为 1–300 秒。");
  const report = await scanRuntime(90), skillPath = canonical(filename);
  const row = report.rows.find(r => r.host === host && r.path === skillPath);
  const call = row?.calls.find(c => c.sessionId === values.get("--session") && c.callId === values.get("--call"));
  if (!row || !call || !callBindsVersion(row, call)) throw new Error("找不到成功加载且正文版本一致的真实调用；拒绝生成通过记录。请先在宿主实际使用该技能。");
  const result = await recordValidation({ skill: row, call, command, scenario: values.get("--scenario")!, checkName: values.get("--check-name")!,
    cwd: process.cwd(), directory: path.join(os.homedir(), ".agents/skillsdoctor/evidence"), timeoutMs: timeout * 1000 });
  console.log(JSON.stringify({ receipt: result.file, passed: result.passed, versionChangedDuringCheck: result.changed, exitCode: result.receipt.validator.exitCode, note: "仅验证指定场景；刷新网页查看。" }));
  if (!result.passed) process.exitCode = 1;
}
main().catch(e => { console.error(e instanceof Error ? e.message : "验收失败。"); process.exitCode = 1; });
