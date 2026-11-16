import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectCatalog } from "../lib/runtime/catalog.ts";
import type { CatalogProbe } from "../lib/runtime/types.ts";

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "skillsdoctor-catalog-"));
  const write = (name: string, content: string) => { const p = path.join(home, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return p; };
  const cleanup = () => fs.rmSync(home, { recursive: true, force: true });
  return { home, write, cleanup };
}
const probe: CatalogProbe = { state: "error", at: "2026-10-24T00:00:00Z", cwd: "/project", skills: [], issues: ["test unavailable"] };
test("同目标软链合并，插件同名异版保留，配置关闭不冒作可见", () => {
  const f = fixture();
  try {
    const source = fs.realpathSync(f.write(".agents/skills/demo/SKILL.md", "---\nname: demo\n---\n# demo"));
    fs.mkdirSync(path.join(f.home, ".claude/skills/demo"), { recursive: true }); fs.symlinkSync(source, path.join(f.home, ".claude/skills/demo/SKILL.md"));
    f.write(".claude/settings.json", JSON.stringify({ enabledPlugins: { "ecc@market": false } }));
    const entries = ["v1", "v2"].map(version => {
      const root = path.join(f.home, "plugins", version);
      f.write(`plugins/${version}/.claude-plugin/plugin.json`, JSON.stringify({ skills: "./skills" }));
      f.write(`plugins/${version}/skills/demo/SKILL.md`, "# plugin demo");
      return { installPath: root, version, scope: "user" };
    });
    f.write(".claude/plugins/installed_plugins.json", JSON.stringify({ plugins: { "ecc@market": entries } }));
    const result = collectCatalog(probe, f.home), rows = result.skills.filter(r => r.host === "claude");
    assert.equal(rows.length, 3); const shared = rows.find(r => r.path === source)!;
    assert.equal(shared.aliases.length, 2); assert.equal(shared.catalog, "unverified");
    assert.equal(rows.filter(r => r.name === "ecc:demo" && r.configured === "disabled").length, 2);
  } finally { f.cleanup(); }
});
test("只有完整原生目录可决定当前列出与禁用；目录加载报错不对缺失条目下否定结论", () => {
  const f = fixture();
  try {
    const source = f.write(".agents/skills/demo/SKILL.md", "# demo");
    for (const enabled of [true, false]) {
      const p = { ...probe, state: "ok" as const, issues: [], skills: [{ name: "demo", path: source, enabled }] };
      assert.equal(collectCatalog(p, f.home).skills.find(r => r.host === "codex")!.catalog, enabled ? "listed" : "disabled");
    }
    assert.equal(collectCatalog({ ...probe, state: "ok", issues: [] }, f.home).skills.find(r => r.host === "codex")!.catalog, "not-listed");
    assert.equal(collectCatalog({ ...probe, state: "ok", issues: ["bad skill"] }, f.home).skills.find(r => r.host === "codex")!.catalog, "unverified");
  } finally { f.cleanup(); }
});
