import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { canonical, digest, skillBody } from "./catalog.ts";
import type { CallEvidence, Coverage, LogEvidence, RuntimeHost, SeenEvidence } from "./types.ts";

type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const text = (v: unknown): string => typeof v === "string" ? v : Array.isArray(v) ? v.map(x => object(x).text).filter(x => typeof x === "string").join("\n") : "";

/** Recognizes structured host records, never guesses skill use from conversational mentions. */
export function createLogParser(host: RuntimeHost, file: string, since: number, until: number) {
  const calls = new Map<string, CallEvidence>(), seen: SeenEvidence[] = [], results = new Map<string, string>(), argumentsByCall = new Map<string, string>();
  let sessionId = path.basename(file, ".jsonl"), cwd = path.dirname(file);
  const add = (id: string, name: string, kind: CallEvidence["kind"], at: string, line: number, skillPath?: string) => {
    const key = `${sessionId}:${id}`;
    if (!calls.has(key)) calls.set(key, { host, sessionId, callId: id, name, kind, at, file, line, outcome: "pending", skillPath });
    return calls.get(key)!;
  };
  function parse(raw: unknown, line: number) {
    const d = object(raw), p = object(d.payload), message = object(d.message);
    if (host === "codex" && d.type === "session_meta") {
      if (typeof p.id === "string") sessionId = p.id;
      if (typeof p.cwd === "string") cwd = p.cwd;
    }
    if (host === "claude" && typeof d.sessionId === "string") sessionId = d.sessionId;
    if (typeof d.cwd === "string") cwd = d.cwd;
    const at = typeof d.timestamp === "string" ? d.timestamp : "";
    const time = Date.parse(at);
    if (!Number.isFinite(time) || time < since || time > until) return;
    if (host === "claude") {
      const content = Array.isArray(message.content) ? message.content.map(object) : [];
      for (const b of content) {
        if (d.type === "assistant" && b.type === "tool_use" && typeof b.id === "string") {
          const input = object(b.input);
          if (b.name === "Skill" && typeof input.skill === "string") {
            add(b.id, input.skill, "skill", at, line);
            if (typeof input.args === "string") argumentsByCall.set(`${sessionId}:${b.id}`, input.args);
          }
          if (b.name === "Read" && typeof input.file_path === "string" && /[/\\]SKILL\.md$/i.test(input.file_path)) {
            const target = canonical(path.resolve(cwd, input.file_path));
            add(b.id, path.basename(path.dirname(target)), "read", at, line, target);
          }
        }
        if (d.type === "user" && b.type === "tool_result" && typeof b.tool_use_id === "string") {
          const c = calls.get(`${sessionId}:${b.tool_use_id}`);
          if (!c) continue;
          const result = object(d.toolUseResult);
          c.outcome = b.is_error === true || result.success === false ? "error" : result.success === true || b.is_error === false ? "loaded" : text(b.content).trim() ? "returned" : "pending";
          if (typeof d.uuid === "string") results.set(d.uuid, c.callId);
        }
      }
      if (d.type === "user" && d.isMeta === true) {
        const body = text(message.content), header = body.match(/^Base directory for this skill:\s*([^\r\n]+)\r?\n\r?\n([\s\S]*)$/);
        const callId = typeof d.sourceToolUseID === "string" ? d.sourceToolUseID : typeof d.parentUuid === "string" ? results.get(d.parentUuid) : undefined;
        const c = callId ? calls.get(`${sessionId}:${callId}`) : undefined;
        if (header && c?.kind === "skill") {
          let injected = header[2].trim();
          const args = argumentsByCall.get(`${sessionId}:${c.callId}`);
          const trailer = args === undefined ? undefined : `\n\nARGUMENTS: ${args}`.trimEnd();
          // Remove only the exact host-appended arguments recorded on this call, never arbitrary text.
          if (trailer && injected.endsWith(trailer)) injected = injected.slice(0, -trailer.length);
          c.skillPath = canonical(path.join(header[1].trim(), "SKILL.md")); c.bodySha256 = digest(skillBody(injected));
          seen.push({ host, path: c.skillPath, at, sessionId, file, line });
        }
      }
    } else if (d.type === "response_item") {
      if (p.type === "message" && p.role === "developer") {
        const body = text(p.content);
        if (body.includes("<skills_instructions>") && body.includes("Available skills")) {
          const roots = new Map([...body.matchAll(/`(r\d+)`\s*=\s*`([^`]+)`/g)].map(m => [m[1], m[2]]));
          for (const m of body.matchAll(/\(file:\s*([^\r\n)]+)\)/g)) {
            const rawPath = m[1].trim();
            const alias = rawPath.match(/^(r\d+)\/(.+)$/);
            const filePath = alias && roots.has(alias[1]) ? path.join(roots.get(alias[1])!, alias[2]) : rawPath;
            if (path.isAbsolute(filePath)) seen.push({ host, path: canonical(filePath), at, sessionId, file, line });
          }
        }
      }
      if (p.type === "function_call" && typeof p.call_id === "string" && ["read_file", "functions.read_file", "Read"].includes(String(p.name))) {
        let args: Obj = {};
        try { args = object(JSON.parse(String(p.arguments))); } catch { return; }
        const filename = args.file_path ?? args.path;
        if (typeof filename === "string" && /[/\\]SKILL\.md$/i.test(filename)) {
          const target = canonical(path.resolve(cwd, filename)); add(p.call_id, path.basename(path.dirname(target)), "read", at, line, target);
        }
      }
      if (p.type === "function_call_output" && typeof p.call_id === "string") {
        const c = calls.get(`${sessionId}:${p.call_id}`);
        if (c) {
          let out: Obj = {};
          try { out = object(JSON.parse(String(p.output))); } catch { /* Unstructured output is not a verified load. */ }
          c.outcome = out.is_error === true || out.success === false ? "error" : out.success === true ? "loaded" : text(p.output).trim() ? "returned" : "pending";
        }
      }
    }
  }
  return { parse, finish: () => ({ calls: [...calls.values()], seen }) };
}

export async function readLogEvidence(options: { home?: string; days?: number; maxBytes?: number; maxFiles?: number; maxMs?: number; now?: Date } = {}): Promise<LogEvidence> {
  const home = options.home ?? os.homedir(), now = options.now ?? new Date();
  const since = now.getTime() - (options.days ?? 30) * 86_400_000, started = Date.now();
  const maxBytes = options.maxBytes ?? 1024 * 1024 * 1024, maxFiles = options.maxFiles ?? 3000, maxMs = options.maxMs ?? 20_000;
  const coverage: Coverage = { since: new Date(since).toISOString(), until: now.toISOString(), filesFound: 0, filesRead: 0, bytesRead: 0, malformedLines: 0, complete: true, issues: [], roots: [] };
  const issue = (message: string) => { coverage.complete = false; coverage.issues.push(message); };
  const files: { path: string; host: RuntimeHost; mtime: number }[] = [], visited = new Set<string>();
  const budgetReached = () => Date.now() - started >= maxMs || coverage.bytesRead >= maxBytes || coverage.filesRead >= maxFiles;
  function walk(dir: string, host: RuntimeHost) {
    if (Date.now() - started >= maxMs) { issue("枚举日志达到时间预算，覆盖不完整。" ); return; }
    let real: string;
    try { real = fs.realpathSync(dir); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") issue(`日志目录不可读：${dir}`); return; }
    if (visited.has(real)) return;
    visited.add(real);
    try {
      for (const e of fs.readdirSync(real, { withFileTypes: true })) {
        const p = path.join(real, e.name);
        if (e.isDirectory()) walk(p, host);
        else if (e.isFile() && e.name.endsWith(".jsonl")) {
          try { const stat = fs.statSync(p); if (stat.mtimeMs >= since) files.push({ path: p, host, mtime: stat.mtimeMs }); }
          catch { issue(`日志文件属性不可读：${p}`); }
        }
      }
    } catch { issue(`日志目录不可读：${real}`); }
  }
  const ccRoots = [path.join(home, ".claude/projects")];
  try {
    for (const e of fs.readdirSync(home, { withFileTypes: true })) if (e.isDirectory() && e.name.startsWith(".claude-") && fs.existsSync(path.join(home, e.name, "settings.json"))) ccRoots.push(path.join(home, e.name, "projects"));
  } catch { issue("无法枚举 Claude 配置目录。" ); }
  for (const root of ccRoots) { coverage.roots.push(root); walk(root, "claude"); }
  const codexRoot = path.join(home, ".codex/sessions"); coverage.roots.push(codexRoot); walk(codexRoot, "codex");
  coverage.filesFound = files.length; files.sort((a, b) => b.mtime - a.mtime);
  const calls: CallEvidence[] = [], latestSeen = new Map<string, SeenEvidence>();
  for (const file of files) {
    if (budgetReached()) { issue(`日志扫描达到设定预算（${maxMs} ms / ${maxBytes} bytes / ${maxFiles} 文件），零记录不代表未使用。`); break; }
    const parser = createLogParser(file.host, file.path, since, now.getTime());
    const stream = fs.createReadStream(file.path, { encoding: "utf8", highWaterMark: 64 * 1024 });
    let buffer = "", line = 0, skipping = false, interrupted = false;
    const accept = (value: string) => {
      line++; if (!value.trim()) return;
      try { parser.parse(JSON.parse(value), line); }
      catch { coverage.malformedLines++; issue(`日志 JSONL 未完成或格式不支持：${file.path}:${line}`); }
    };
    try {
      for await (const chunk of stream) {
        coverage.bytesRead += Buffer.byteLength(chunk);
        if (budgetReached()) { issue("读取日志达到预算，当前文件未读完。" ); interrupted = true; break; }
        const parts = chunk.split("\n");
        for (let i = 0; i < parts.length; i++) {
          if (!skipping) buffer += parts[i];
          if (buffer.length > 8 * 1024 * 1024) { issue(`日志行超过 8 MiB，已跳过：${file.path}:${line + 1}`); buffer = ""; skipping = true; }
          if (i < parts.length - 1) { if (!skipping) accept(buffer); else line++; buffer = ""; skipping = false; }
        }
      }
      if (buffer && !interrupted && !skipping) accept(buffer);
      if (!interrupted) coverage.filesRead++;
    } catch { issue(`日志读取失败：${file.path}`); }
    finally { stream.destroy(); }
    const parsed = parser.finish(); calls.push(...parsed.calls);
    for (const s of parsed.seen) { const key = `${s.host}:${s.path}`; if (!latestSeen.has(key) || latestSeen.get(key)!.at < s.at) latestSeen.set(key, s); }
  }
  if (!files.length) issue("没有找到时间范围内的可读持久化日志；不能据此判断未调用。" );
  return { calls, seen: [...latestSeen.values()], coverage };
}
