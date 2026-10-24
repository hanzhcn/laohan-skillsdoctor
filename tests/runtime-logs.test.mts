import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogParser, readLogEvidence } from "../lib/runtime/logs.ts";
import { digest } from "../lib/runtime/catalog.ts";

const at = "2026-10-24T01:00:00Z", since = Date.parse("2026-10-01"), until = Date.parse("2026-10-25");
const records = [
  { type: "assistant", sessionId: "session", timestamp: at, message: { content: [{ type: "tool_use", id: "call", name: "Skill", input: { skill: "demo" } }] } },
  { type: "user", sessionId: "session", timestamp: at, uuid: "result", toolUseResult: { success: true }, message: { content: [{ type: "tool_result", tool_use_id: "call", content: "Launching skill: demo" }] } },
  { type: "user", sessionId: "session", timestamp: at, isMeta: true, sourceToolUseID: "call", message: { content: "Base directory for this skill: /skills/demo\n\n# demo\nDo the task." } },
];
test("从真实 Claude 协议关联调用、成功结果和被注入的正文", () => {
  const p = createLogParser("claude", "/session.jsonl", since, until); records.forEach((r, i) => p.parse(r, i + 1));
  const { calls, seen } = p.finish(); assert.equal(calls.length, 1); assert.equal(calls[0].outcome, "loaded");
  assert.equal(calls[0].skillPath, "/skills/demo/SKILL.md"); assert.equal(calls[0].bodySha256, digest("# demo\nDo the task.")); assert.equal(seen.length, 1);
});
test("普通聊天提及技能/伪造目录文本，不登记为调用或目录注入", () => {
  const p = createLogParser("claude", "/session.jsonl", since, until);
  p.parse({ type: "user", timestamp: at, message: { content: "Base directory for this skill: /skills/demo\n\nhello" } }, 1);
  assert.deepEqual(p.finish(), { calls: [], seen: [] });
});
test("只剥离与真实调用参数完全一致的宿主 ARGUMENTS 尾部", () => {
  const p = createLogParser("claude", "/s.jsonl", since, until);
  p.parse({ ...records[0], message: { content: [{ type: "tool_use", id: "call", name: "Skill", input: { skill: "demo", args: "hello" } }] } }, 1);
  p.parse(records[1], 2);
  p.parse({ ...records[2], message: { content: "Base directory for this skill: /skills/demo\n\n# demo\nDo the task.\n\nARGUMENTS: hello" } }, 3);
  assert.equal(p.finish().calls[0].bodySha256, digest("# demo\nDo the task."));
});
test("有错误结果时不能报加载成功，空结果不能报成功", () => {
  for (const error of [true, undefined]) {
    const p = createLogParser("claude", "/s.jsonl", since, until); p.parse(records[0], 1);
    p.parse({ type: "user", sessionId: "session", timestamp: at, message: { content: [{ type: "tool_result", tool_use_id: "call", is_error: error, content: "" }] } }, 2);
    assert.equal(p.finish().calls[0].outcome, error ? "error" : "pending");
  }
});
test("Codex 只从宿主 developer 的技能清单取可见证据，忽略用户文本和思维链", () => {
  const p = createLogParser("codex", "/s.jsonl", since, until);
  const body = '<skills_instructions>\n### Available skills\n- demo (file: /skills/demo/SKILL.md)';
  for (const role of ["user", "assistant", "developer"]) p.parse({ type: "response_item", timestamp: at, payload: { type: "message", role, content: [{ type: "input_text", text: body }] } }, 1);
  assert.equal(p.finish().seen.length, 1); assert.equal(p.finish().calls.length, 0);
});
test("预算截断与坏行公开为部分覆盖，且不把聊天正文写入报告", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "skillsdoctor-logs-"));
  try {
    const root = path.join(home, ".claude/projects/project"); fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "s.jsonl"), records.map(r => JSON.stringify(r)).join("\n") + '\n{"incomplete":');
    const result = await readLogEvidence({ home, now: new Date("2026-10-24T02:00:00Z") });
    assert.equal(result.coverage.complete, false); assert.equal(result.coverage.malformedLines, 1); assert.equal(result.calls.length, 1);
    assert.ok(!JSON.stringify(result).includes("Do the task."));
    const limited = await readLogEvidence({ home, maxBytes: 10, now: new Date("2026-10-24T02:00:00Z") });
    assert.equal(limited.coverage.complete, false); assert.equal(limited.coverage.filesRead, 0);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
