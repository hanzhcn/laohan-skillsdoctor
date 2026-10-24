import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectCatalog } from "./catalog.ts";
import { probeCodex } from "./codex.ts";
import { readLogEvidence } from "./logs.ts";
import { buildRuntimeRows, isValidationReceipt } from "./evidence.ts";
import type { RuntimeReport, ValidationReceipt } from "./types.ts";

export function readReceipts(home = os.homedir()) {
  const directory = path.join(home, ".agents/skillsdoctor/evidence");
  const receipts: ValidationReceipt[] = [], issues: string[] = [];
  try {
    const files = fs.readdirSync(directory).filter(n => n.endsWith(".json"));
    if (files.length > 5000) { issues.push("验收记录超过 5000 份，未加载；有效性未验证。" ); return { receipts, issues }; }
    for (const name of files) {
      const file = path.join(directory, name);
      try {
        if (fs.statSync(file).size > 128 * 1024) throw new Error();
        const r: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!isValidationReceipt(r) || !path.isAbsolute(r.skillPath)) throw new Error();
        receipts.push(r);
      } catch { issues.push(`验收记录无效，未当作通过：${file}`); }
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") issues.push(`无法读取验收记录目录：${directory}`); }
  return { receipts, issues };
}

const pending = new Map<number, Promise<RuntimeReport>>();
const cached = new Map<number, { expires: number; report: RuntimeReport }>();

export function scanRuntime(days = 30): Promise<RuntimeReport> {
  const hit = cached.get(days);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.report);
  const running = pending.get(days); if (running) return running;
  const task = (async () => {
    const cwd = process.cwd();
    const [probe, logs] = await Promise.all([probeCodex(cwd), readLogEvidence({ days })]);
    const catalog = collectCatalog(probe), validation = readReceipts();
    const rows = buildRuntimeRows(catalog.skills, logs.calls, logs.seen, validation.receipts);
    const report: RuntimeReport = { at: new Date().toISOString(), cwd, rows, coverage: logs.coverage,
      codex: { state: probe.state, at: probe.at, cwd: probe.cwd, issues: probe.issues,
        listed: probe.skills.filter(s => s.enabled).length, disabled: probe.skills.filter(s => !s.enabled).length },
      issues: [...catalog.issues, ...validation.issues],
      summary: { total: rows.length, listed: rows.filter(r => r.catalog === "listed").length,
        called: rows.filter(r => r.calls.length).length,
        loaded: rows.filter(r => r.calls.some(c => c.outcome === "loaded")).length,
        failed: rows.filter(r => r.calls.some(c => c.outcome === "error")).length,
        validated: rows.filter(r => r.effectiveness.state === "passed").length,
        stale: rows.filter(r => r.effectiveness.state === "stale").length,
        unverified: rows.filter(r => r.effectiveness.state === "unverified").length } };
    cached.set(days, { expires: Date.now() + 30_000, report });
    return report;
  })().finally(() => pending.delete(days));
  pending.set(days, task); return task;
}
