import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import type { CatalogProbe, RuntimeHost, RuntimeSkill } from "./types.ts";

export const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
export const skillBody = (text: string) => text.replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
export function canonical(file: string): string {
  try { return fs.realpathSync(file); } catch { return path.resolve(file); }
}

export function collectCatalog(probe: CatalogProbe, home = os.homedir()) {
  const rows = new Map<string, RuntimeSkill>(), issues: string[] = [];
  const started = Date.now(); let directories = 0, exhausted = false;
  function json(file: string): Record<string, unknown> | null {
    try { const obj = JSON.parse(fs.readFileSync(file, "utf8")); if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error(); return obj; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") issues.push(`无法读取配置/登记：${file}`); return null; }
  }
  const settingsFile = path.join(home, ".claude/settings.json");
  const settings = json(settingsFile);
  const enabledPlugins = settings?.enabledPlugins as Record<string, boolean> | undefined;
  function add(file: string, host: RuntimeHost, source: string, configured: RuntimeSkill["configured"], publicName?: string) {
    try {
      const real = fs.realpathSync(file), stat = fs.statSync(real);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) { issues.push(`技能文件不合法或超过 2 MiB：${file}`); return; }
      const text = fs.readFileSync(real, "utf8"), folder = path.basename(path.dirname(file));
      const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
      const nameLine = fm.match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
      const name = nameLine && !/^[>|{[]/.test(nameLine) ? nameLine.replace(/^['"]|['"]$/g, "") : folder;
      const names = publicName ? [publicName] : [name, folder];
      const key = `${host}:${real}`;
      const old = rows.get(key);
      if (old) {
        old.aliases = [...new Set([...old.aliases, file])]; old.names = [...new Set([...old.names, ...names])];
        if (configured === "available") old.configured = "available";
        return;
      }
      rows.set(key, { id: digest(key).slice(0, 20), host, name: publicName ?? name,
        names: [...new Set(names)], path: real, aliases: [file], sha256: digest(text), bodySha256: digest(skillBody(text)), modifiedAt: stat.mtime.toISOString(), source,
        configured, catalog: "unverified", manualOnly: host === "claude" && /^disable-model-invocation:\s*true\s*$/m.test(fm) });
    } catch (e) { issues.push(`无法读取技能：${file}（${(e as NodeJS.ErrnoException).code ?? "读取失败"}）`); }
  }
  const skip = new Set(["node_modules", ".git", ".next", ".cache"]);
  function walk(dir: string, host: RuntimeHost, source: string, configured: RuntimeSkill["configured"], namespace?: string, ancestors = new Set<string>()) {
    if (exhausted) return;
    if (++directories > 10_000 || Date.now() - started > 3_000 || ancestors.size > 64) {
      issues.push("文件目录扫描达到 3 秒 / 10000 目录 / 64 层上限，部分入口未覆盖。"); exhausted = true; return;
    }
    if (!fs.existsSync(dir)) return;
    try {
      const real = fs.realpathSync(dir);
      if (ancestors.has(real)) { issues.push(`目录链接循环：${dir}`); return; }
      const next = new Set(ancestors); next.add(real);
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const full = path.join(dir, e.name);
        try {
          const stat = e.isSymbolicLink() ? fs.statSync(full) : null;
          if (e.isDirectory() || stat?.isDirectory()) walk(full, host, source, configured, namespace, next);
          else if (/^skill\.md$/i.test(e.name)) add(full, host, source, configured, namespace ? `${namespace}:${path.basename(dir)}` : undefined);
        } catch (err) { issues.push(`技能入口不可读：${full}（${(err as NodeJS.ErrnoException).code ?? "读取失败"}）`); }
      }
    } catch { issues.push(`无法扫描目录：${dir}`); }
  }
  walk(path.join(home, ".claude/skills"), "claude", "Claude 主配置的全局目录", settings ? "available" : "unknown");
  walk(path.join(home, ".agents/skills"), "claude", "共享库；不据此认定 CC 可见", "unknown");
  walk(path.join(home, ".agents/skills"), "codex", "共享技能目录", "unknown");
  walk(path.join(home, ".codex/skills"), "codex", "Codex 全局目录", "unknown");
  const registry = json(path.join(home, ".claude/plugins/installed_plugins.json"));
  if (registry?.plugins && typeof registry.plugins === "object") {
    for (const [plugin, entries] of Object.entries(registry.plugins)) {
      if (!Array.isArray(entries)) { issues.push(`插件登记格式不支持：${plugin}`); continue; }
      for (const e of entries) {
        if (!e || typeof e.installPath !== "string") { issues.push(`插件路径缺失：${plugin}`); continue; }
        const manifest = json(path.join(e.installPath, ".claude-plugin/plugin.json"));
        const roots = manifest?.skills === undefined ? ["skills"] : Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
        const state = enabledPlugins?.[plugin] === false ? "disabled" : enabledPlugins?.[plugin] === true && e.scope === "user" ? "available" : "unknown";
        for (const root of roots) {
          if (typeof root !== "string") { issues.push(`插件技能声明格式不支持：${plugin}`); continue; }
          const folder = path.resolve(e.installPath, root);
          const relative = path.relative(path.resolve(e.installPath), folder);
          if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) { issues.push(`插件技能声明超出插件目录，未扫描：${plugin}`); continue; }
          if (path.basename(folder).toLowerCase() === "skill.md") add(folder, "claude", `${plugin} · ${e.version ?? "版本未知"}`, state, `${plugin.split("@")[0]}:${path.basename(path.dirname(folder))}`);
          else walk(folder, "claude", `${plugin} · ${e.version ?? "版本未知"}`, state, plugin.split("@")[0]);
        }
      }
    }
  }
  if (probe.state === "ok") {
    for (const s of probe.skills) add(s.path, "codex", "Codex 原生目录", s.enabled ? "available" : "disabled", s.name);
    const current = new Map(probe.skills.map(s => [canonical(s.path), s]));
    for (const row of rows.values()) if (row.host === "codex") {
      const item = current.get(row.path);
      row.catalog = item ? item.enabled ? "listed" : "disabled" : probe.issues.length ? "unverified" : "not-listed";
      if (item) { row.name = item.name; row.names = [...new Set([...row.names, item.name])]; row.configured = item.enabled ? "available" : "disabled"; }
    }
  }
  return { skills: [...rows.values()].sort((a, b) => a.host.localeCompare(b.host) || a.name.localeCompare(b.name) || a.path.localeCompare(b.path)), issues };
}
