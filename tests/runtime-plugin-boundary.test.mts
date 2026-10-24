import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectCatalog } from "../lib/runtime/catalog.ts";

test("插件组件声明不能把扫描扩成整个HOME或任意父目录", () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "skillsdoctor-plugin-boundary-")));
  try {
    const plugin = path.join(home, "plugin"), config = path.join(home, ".claude/plugins");
    fs.mkdirSync(path.join(plugin, ".claude-plugin"), { recursive: true }); fs.mkdirSync(config, { recursive: true });
    fs.writeFileSync(path.join(plugin, ".claude-plugin/plugin.json"), JSON.stringify({ skills: ".." }));
    fs.writeFileSync(path.join(home, "SKILL.md"), "# NOT_A_PLUGIN_SKILL");
    fs.writeFileSync(path.join(config, "installed_plugins.json"), JSON.stringify({ plugins: { "evil@fixture": [{ installPath: plugin, scope: "user" }] } }));
    const r = collectCatalog({ state: "error", at: "2026-10-24", cwd: home, skills: [], issues: [] }, home);
    assert.equal(r.skills.length, 0); assert.ok(r.issues.some(x => x.includes("超出插件目录")));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
