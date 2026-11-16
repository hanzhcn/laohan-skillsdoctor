import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordValidation } from "../lib/runtime/validate.ts";
import { digest, skillBody } from "../lib/runtime/catalog.ts";
import { createLogParser } from "../lib/runtime/logs.ts";
import { buildRuntimeRows } from "../lib/runtime/evidence.ts";
import type { RuntimeSkill } from "../lib/runtime/types.ts";

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "skillsdoctor-validation-")));
  const file = path.join(root, "SKILL.md"), content = "---\nname: demo\n---\n# demo\nValidate the requested artifact.";
  fs.writeFileSync(file, content);
  fs.utimesSync(file, new Date(Date.now() - 2000), new Date(Date.now() - 2000));
  const skill: RuntimeSkill = { id: "demo", host: "claude", name: "demo", names: ["demo"], path: file,
    sha256: digest(content), bodySha256: digest(skillBody(content)), modifiedAt: fs.statSync(file).mtime.toISOString(), aliases: [file], source: "isolated fixture", configured: "available", catalog: "unverified", manualOnly: false };
  const at = new Date(Date.now() - 1000).toISOString();
  const parser = createLogParser("claude", path.join(root, "session.jsonl"), 0, Date.now());
  parser.parse({ type: "assistant", sessionId: "fixture", timestamp: at, message: { content: [{ type: "tool_use", id: "call", name: "Skill", input: { skill: "demo" } }] } }, 1);
  parser.parse({ type: "user", sessionId: "fixture", timestamp: at, toolUseResult: { success: true }, message: { content: [{ type: "tool_result", tool_use_id: "call", content: "Launching skill: demo" }] } }, 2);
  parser.parse({ type: "user", sessionId: "fixture", timestamp: at, isMeta: true, sourceToolUseID: "call", message: { content: `Base directory for this skill: ${root}\n\n${skillBody(content)}` } }, 3);
  const call = parser.finish().calls[0];
  return { root, skill, call, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
test("真实解析→实际验收程序→本地回执→界面判据闭合，不保存命令参数与输出", async () => {
  const f = fixture();
  try {
    const r = await recordValidation({ skill: f.skill, call: f.call, command: [process.execPath, "-e", 'process.stdout.write("PRIVATE_TEST_OUTPUT")'],
      scenario: "验证示例产物", checkName: "示例检查", cwd: f.root, directory: path.join(f.root, "receipts"), timeoutMs: 2000 });
    assert.equal(r.passed, true); const saved = fs.readFileSync(r.file, "utf8");
    assert.ok(!saved.includes("PRIVATE_TEST_OUTPUT") && !saved.includes("process.stdout.write"));
    assert.equal(buildRuntimeRows([f.skill], [f.call], [], [JSON.parse(saved)])[0].effectiveness.state, "passed");
  } finally { f.cleanup(); }
});
test("非零退出和超时都保存失败记录并保持失败", async () => {
  const f = fixture();
  try {
    for (const [script, timeoutMs] of [["process.exit(3)", 2000], ["setTimeout(()=>{}, 5000)", 25]] as const) {
      const r = await recordValidation({ skill: f.skill, call: f.call, command: [process.execPath, "-e", script], scenario: "失败场景", checkName: "失败检查", cwd: f.root, directory: path.join(f.root, "receipts"), timeoutMs });
      assert.equal(r.passed, false); assert.equal(buildRuntimeRows([f.skill], [f.call], [], [r.receipt])[0].effectiveness.state, "failed");
    }
  } finally { f.cleanup(); }
});
test("没有匹配调用或文件版本变化时，不执行用户验收程序", async () => {
  const f = fixture();
  try {
    const marker = path.join(f.root, "MUST_NOT_EXIST");
    const base = { skill: f.skill, command: [process.execPath, "-e", `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`], scenario: "拦截", checkName: "拦截检查", cwd: f.root, directory: path.join(f.root, "receipts"), timeoutMs: 2000 };
    await assert.rejects(recordValidation({ ...base, call: { ...f.call, outcome: "error" } }));
    fs.appendFileSync(f.skill.path, "\nnew version");
    await assert.rejects(recordValidation({ ...base, call: f.call }));
    assert.equal(fs.existsSync(marker), false);
  } finally { f.cleanup(); }
});
test("验收期间改写技能不能得到当前版本通过", async () => {
  const f = fixture();
  try {
    const r = await recordValidation({ skill: f.skill, call: f.call,
      command: [process.execPath, "-e", `require('fs').appendFileSync(${JSON.stringify(f.skill.path)}, '\\nchanged')`],
      scenario: "变更场景", checkName: "文件变更", cwd: f.root, directory: path.join(f.root, "receipts"), timeoutMs: 2000 });
    assert.equal(r.changed, true); assert.equal(r.passed, false);
    const current = { ...f.skill, sha256: digest(fs.readFileSync(f.skill.path)) };
    assert.equal(buildRuntimeRows([current], [f.call], [], [r.receipt])[0].effectiveness.state, "stale");
  } finally { f.cleanup(); }
});
