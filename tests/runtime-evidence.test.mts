import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeRows } from "../lib/runtime/evidence.ts";
import type { RuntimeSkill, CallEvidence, ValidationReceipt } from "../lib/runtime/types.ts";

const sha = "a".repeat(64), body = "b".repeat(64);
const skill: RuntimeSkill = { id: "s", host: "claude", name: "demo", names: ["demo"], path: "/skills/demo/SKILL.md", sha256: sha, bodySha256: body, modifiedAt: "2026-10-24T00:00:00Z", aliases: [], source: "local", configured: "available", catalog: "unverified", manualOnly: false };
const call: CallEvidence = { host: "claude", sessionId: "session", callId: "call", name: "demo", kind: "skill", at: "2026-10-24T01:00:00Z", file: "/log.jsonl", line: 1, outcome: "loaded", skillPath: skill.path, bodySha256: body };
const receipt: ValidationReceipt = { schemaVersion: 1, host: "claude", skillPath: skill.path, documentSha256: sha, sessionId: "session", callId: "call", scenario: "已调用技能后的验收场景", validator: { name: "fixture check", commandSha256: sha, startedAt: "2026-10-24T01:01:00Z", finishedAt: "2026-10-24T01:02:00Z", exitCode: 0, timedOut: false, stdoutSha256: sha, stderrSha256: sha } };
const run = (calls: CallEvidence[] = [], receipts: ValidationReceipt[] = [], skills = [skill]) => buildRuntimeRows(skills, calls, [], receipts, new Date("2026-10-24T02:00:00Z"));

test("文件可达不冒作当前目录可见或有效执行", () => {
  const [r] = run(); assert.equal(r.catalog, "unverified"); assert.equal(r.calls.length, 0); assert.equal(r.effectiveness.state, "unverified");
});
test("调用加载成功仍不是业务验收通过", () => { assert.equal(run([call])[0].effectiveness.state, "unverified"); });
test("调用后只改元数据也不能把新版本归给旧调用", () => {
  assert.equal(run([call], [receipt], [{ ...skill, modifiedAt: "2026-10-24T01:00:01Z" }])[0].effectiveness.state, "unverified");
});
test("成功记录必须绑定版本、调用和验收场景", () => { assert.equal(run([call], [receipt])[0].effectiveness.state, "passed"); });
test("版本改变让旧验收失效", () => { assert.equal(run([call], [receipt], [{ ...skill, sha256: "c".repeat(64) }])[0].effectiveness.state, "stale"); });
test("加载失败和缺少调用不会被验收记录伪装成通过", () => {
  assert.equal(run([{ ...call, outcome: "error" }], [receipt])[0].effectiveness.state, "unverified");
  assert.equal(run([], [receipt])[0].effectiveness.state, "unverified");
});
test("同名不同文件不能将一次调用分摊给两者", () => {
  const other = { ...skill, id: "s2", path: "/other/SKILL.md" };
  const rows = run([{ ...call, skillPath: undefined, bodySha256: undefined }], [], [skill, other]);
  assert.ok(rows.every(r => r.calls.length === 0 && r.ambiguousCalls === 1));
});
test("明确路径只归属被调用的真实文件，调用 ID 按会话去重", () => {
  const rows = run([call, call, { ...call, sessionId: "session2" }], [], [skill, { ...skill, id: "s2", path: "/other/SKILL.md" }]);
  assert.equal(rows[0].calls.length, 2); assert.equal(rows[1].calls.length, 0);
});
test("正文不匹配、跨宿主、未来和倒序回执都不能通过", () => {
  assert.equal(run([{ ...call, bodySha256: "c".repeat(64) }], [receipt])[0].effectiveness.state, "unverified");
  assert.equal(run([call], [{ ...receipt, host: "codex" }])[0].effectiveness.state, "unverified");
  assert.equal(run([call], [{ ...receipt, validator: { ...receipt.validator, finishedAt: "2099-01-01" } }])[0].effectiveness.state, "unverified");
  assert.equal(run([call], [{ ...receipt, validator: { ...receipt.validator, finishedAt: "2026-10-23" } }])[0].effectiveness.state, "unverified");
});
test("最新有效验收失败会覆盖此前通过，不用旧通过掩盖新失败", () => {
  const failed = { ...receipt, validator: { ...receipt.validator, startedAt: "2026-10-24T01:03:00Z", finishedAt: "2026-10-24T01:04:00Z", exitCode: 1 } };
  assert.equal(run([call], [receipt, failed])[0].effectiveness.state, "failed");
});
