import { spawn } from "node:child_process";
import type { CatalogProbe } from "./types.ts";

// Only initialize + skills/list. Never starts a thread/turn or submits a model request.
export function probeCodex(cwd: string, timeoutMs = 10_000): Promise<CatalogProbe> {
  return new Promise(resolve => {
    const at = new Date().toISOString();
    const child = spawn("codex", ["app-server", "--stdio"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", bytes = 0, done = false;
    const finish = (result: CatalogProbe) => {
      if (done) return;
      done = true; clearTimeout(timer); child.stdin.destroy(); child.kill("SIGTERM");
      const killTimer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 1_000);
      killTimer.unref(); child.once("exit", () => clearTimeout(killTimer));
      resolve(result);
    };
    const fail = (message: string) => finish({ state: "error", at, cwd, skills: [], issues: [message] });
    const timer = setTimeout(() => fail("Codex 目录探测超时，当前可见性未验证。"), timeoutMs);
    child.once("error", e => fail(`无法启动 Codex 目录探测：${"code" in e ? e.code : "进程错误"}`));
    child.once("exit", () => { if (!done) fail("Codex 在返回完整目录前退出。" ); });
    child.stdin.on("error", () => { if (!done) fail("Codex 目录协议写入失败。" ); });
    child.stderr.resume(); // Do not expose diagnostics that may contain private configuration.
    const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + "\n");
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 16 * 1024 * 1024) return fail("Codex 目录响应超过 16 MiB，未当作完整目录。" );
      buffer += chunk;
      let boundary: number;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
        let message;
        try { message = JSON.parse(line); } catch { return fail("Codex 返回无效目录协议。" ); }
        if (message.id === 1) {
          if (message.error || !message.result) return fail("Codex 初始化失败。" );
          send({ method: "initialized" });
          send({ id: 2, method: "skills/list", params: { cwds: [cwd], forceReload: true } });
        }
        if (message.id !== 2) continue;
        const data = message.result?.data;
        if (message.error || !Array.isArray(data) || data.length !== 1 || data[0].cwd !== cwd ||
          !Array.isArray(data[0].skills) || !Array.isArray(data[0].errors)) return fail("Codex 未返回当前目录的完整技能列表。" );
        if (!data[0].skills.every((s: Record<string, unknown>) => typeof s.name === "string" && typeof s.path === "string" && typeof s.enabled === "boolean")) return fail("Codex 技能字段不符合本机协议。" );
        finish({ state: "ok", at, cwd, skills: data[0].skills,
          issues: data[0].errors.map((e: { path?: string }) => `Codex 报告技能加载错误：${e.path ?? "未知路径"}`) });
      }
    });
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "skillsdoctor", version: "0.2.0" } } });
  });
}
