"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RuntimeReport, RuntimeRow } from "@/lib/runtime/types";

const date = (v: string) => new Date(v).toLocaleString("zh-CN", { hour12: false });
const catalogLabels = { listed: "本次目录可见", disabled: "宿主配置关闭", "not-listed": "本次目录未列出", unverified: "当前列表未验证" };
const resultLabels = { passed: "场景验收通过", failed: "场景验收失败", stale: "版本变化，旧记录过期", unverified: "有效性未验证" };
const outcomeLabels = { loaded: "加载成功", error: "加载失败", returned: "已有返回，成功未确认", pending: "未找到完成结果" };

export function RuntimePanel() {
  const [data, setData] = useState<RuntimeReport | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30), [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(""), [host, setHost] = useState(""), [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/runtime?days=${days}`, { signal: controller.signal })
      .then(async r => { const value = await r.json(); if (!r.ok) throw new Error(value.error ?? "读取运行证据失败"); return value as RuntimeReport; })
      .then(value => { if (!controller.signal.aborted) { setData(value); setError(null); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "读取失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, refresh]);
  const rows = useMemo(() => (data?.rows ?? []).filter(r => {
    const q = search.trim().toLowerCase();
    if (host && r.host !== host) return false;
    if (q && ![r.name, r.path, r.source, ...r.names].join(" ").toLowerCase().includes(q)) return false;
    if (status === "called" && !r.calls.length) return false;
    if (status === "error" && !r.calls.some(c => c.outcome === "error")) return false;
    if (status === "listed" && r.catalog !== "listed") return false;
    if (status === "validated" && r.effectiveness.state !== "passed") return false;
    if (status === "unverified" && r.effectiveness.state !== "unverified") return false;
    if (status === "stale" && r.effectiveness.state !== "stale") return false;
    return true;
  }), [data, host, search, status]);
  const reload = () => { setLoading(true); setError(null); setRefresh(v => v + 1); };
  return (
    <section className="mb-10 space-y-4" aria-labelledby="runtime-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="runtime-title" className="text-xl font-semibold">技能运行证据</h2>
          <p className="text-sm text-muted-foreground">分开核验宿主可见、真实调用与场景验收。文件存在、加载成功都不能单独证明结果有效。</p></div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>{loading ? "读取证据中…" : "刷新运行证据"}</Button>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">
        当前检查 Claude 主配置的全局入口与 Codex 原生目录；Claude 系列日志共享时无法确认使用了哪个配置。
        Codex 日志仅识别结构化读取工具，Shell / exec 中的读取不猜作调用。OpenClaw 等其他宿主暂未接入运行态。
        全程不调用模型、不自动执行技能；无证据显示“未验证”。
      </div>
      {error && <p role="alert" className="text-red-600">{error}；不能据此判断技能正常。</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">正在读取目录与本地日志，通常数秒，最多约 30 秒。已有数据如仍显示，属于上次扫描。</p>}
      {data && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["本次 Codex 目录可见", data.summary.listed], ["观察到调用/读取的条目", data.summary.called], ["有加载成功记录的条目", data.summary.loaded], ["有场景验收通过记录", data.summary.validated]].map(([label, count]) =>
            <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}
        </div>
        <div className="text-xs leading-6 text-muted-foreground">
          扫描于 {date(data.at)} · 日志 {date(data.coverage.since)} 至 {date(data.coverage.until)} · 已读 {data.coverage.filesRead}/{data.coverage.filesFound} 文件 · {(data.coverage.bytesRead / 1024 / 1024).toFixed(1)} MiB。
          <br />Codex 目录探测：{data.codex.state === "ok" ? "协议返回完成" : "未完成"}，范围目录 <code className="break-all">{data.cwd}</code>；不代表其他项目或已开启会话的清单相同。结果合并缓存 30 秒。
        </div>
        {(!data.coverage.complete || data.codex.state !== "ok" || data.codex.issues.length > 0 || data.issues.length > 0) && <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">证据覆盖不完整或宿主报告错误；没有记录不能判定没有使用。</p>}
        {(data.issues.length + data.coverage.issues.length + data.codex.issues.length > 0) && <details className="rounded border p-3 text-xs"><summary className="cursor-pointer">查看全部扫描问题与边界（{data.issues.length + data.coverage.issues.length + data.codex.issues.length}）</summary><ul className="mt-2 space-y-1 break-all">{[...data.codex.issues, ...data.coverage.issues, ...data.issues].map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
        <div className="flex flex-wrap gap-2">
          <label className="flex-1 text-xs">搜索名称或路径<input aria-label="搜索运行证据" className="mt-1 block w-full min-w-48 rounded border bg-background p-2 text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="技能名称、来源、真实路径" /></label>
          <label className="text-xs">宿主<select aria-label="运行证据宿主" className="mt-1 block rounded border bg-background p-2 text-sm" value={host} onChange={e => setHost(e.target.value)}><option value="">全部宿主</option><option value="claude">Claude Code</option><option value="codex">Codex</option></select></label>
          <label className="text-xs">情况<select aria-label="运行证据情况" className="mt-1 block rounded border bg-background p-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="">全部情况</option><option value="listed">本次目录可见</option><option value="called">有调用或读取</option><option value="error">有加载失败</option><option value="validated">有场景验收通过</option><option value="stale">旧验收已过期</option><option value="unverified">有效性未验证</option></select></label>
          <label className="text-xs">日志范围<select aria-label="日志范围" className="mt-1 block rounded border bg-background p-2 text-sm" value={days} disabled={loading} onChange={e => { setLoading(true); setError(null); setDays(Number(e.target.value)); }}><option value={7}>最近 7 天</option><option value={30}>最近 30 天</option><option value={90}>最近 90 天</option></select></label>
        </div>
        <p role="status" className="text-xs text-muted-foreground">运行证据显示 {rows.length} / {data.rows.length} 项；同文件的不同宿主分别核验，同名异版保留真实路径。</p>
        <div className="max-h-[65vh] overflow-auto rounded-lg border">
          <table className="w-full min-w-[1080px] text-left text-xs"><thead className="sticky top-0 z-10 bg-muted"><tr>{["技能 / 证据详情", "宿主与入口", "是否可见", "实际调用 / 读取", "加载结果", "有效执行的验收证据"].map(t => <th key={t} className="p-3 font-medium">{t}</th>)}</tr></thead><tbody>{rows.map(r => <RuntimeEvidenceRow key={r.id} row={r} />)}{!rows.length && <tr><td className="p-8 text-center text-muted-foreground" colSpan={6}>当前筛选没有证据条目；不代表技能无用。</td></tr>}</tbody></table>
        </div>
        <details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-medium">如何补充“有效执行”的证据</summary><div className="mt-2 space-y-2 text-muted-foreground">
          <p>先在实际宿主中使用技能，再对产物运行与你的验收场景对应的检查。网页只读已有记录，不替你执行未知技能或命令。</p>
          <p>在项目终端运行 <code>npm run verify:skill -- --help</code> 查看记录命令；填入详情中的会话 ID、调用 ID、技能绝对路径、场景，以及你选择的验收程序。只有成功加载的正文与当前版本一致才允许记录；通过与失败都会保存。</p>
          <p>验收记录只证明一次指定场景的检查结果。创作质量、是否遵守所有步骤及人的接受仍需相应判断；没有可验证的调用、正文动态替换无法匹配或日志缺失时，保持未验证。</p>
        </div></details>
      </>}
    </section>
  );
}

function RuntimeEvidenceRow({ row: r }: { row: RuntimeRow }) {
  const count = (outcome: string) => r.calls.filter(c => c.outcome === outcome).length;
  return <tr className="border-t align-top hover:bg-muted/30">
    <td className="max-w-80 p-3"><details><summary className="cursor-pointer break-all font-mono font-medium">{r.name}</summary><div className="mt-2 space-y-2 break-all text-muted-foreground">
      <p>{r.source}</p><p>真实路径：{r.path}</p><p>文件 SHA-256：{r.sha256}</p>
      <p>入口：{r.aliases.join("；")}</p>
      {r.lastSeen && <p>最近注入证据：{r.lastSeen.file}:{r.lastSeen.line}；会话 {r.lastSeen.sessionId}</p>}
      {r.calls.map(c => <div key={`${c.sessionId}:${c.callId}`} className="rounded border p-2"><p>{c.kind === "skill" ? "Skill 调用" : "结构化读取"} · {outcomeLabels[c.outcome]} · {date(c.at)}</p><p>会话：{c.sessionId}</p><p>调用：{c.callId}</p><p>日志：{c.file}:{c.line}</p><p>{c.skillPath ? "已关联实际路径" : "仅按名称匹配，历史版本未绑定"}；{c.bodySha256 === r.bodySha256 ? "加载正文与当前一致" : "加载正文版本未确认"}</p></div>)}
      {r.ambiguousCalls > 0 && <p>另有 {r.ambiguousCalls} 次同名调用无法唯一归属，没有分摊给各版本。</p>}
    </div></details></td>
    <td className="p-3"><p>{r.host === "claude" ? "Claude Code" : "Codex"}</p><p className="mt-1 text-muted-foreground">{r.configured === "available" ? "全局入口/配置可达" : r.configured === "disabled" ? "配置关闭" : "启用状态待核"}{r.manualOnly ? "；仅手动触发" : ""}</p></td>
    <td className="p-3"><Badge variant="outline" className={r.catalog === "listed" ? "text-emerald-700" : "text-muted-foreground"}>{catalogLabels[r.catalog]}</Badge>{r.lastSeen && <p className="mt-2 text-muted-foreground">历史会话曾注入<br />{date(r.lastSeen.at)}</p>}</td>
    <td className="p-3">{r.calls.length ? <><p>Skill：{r.calls.filter(c => c.kind === "skill").length} 次</p><p>读取：{r.calls.filter(c => c.kind === "read").length} 次</p><p className="mt-1 text-muted-foreground">{date(r.calls[0].at)}</p></> : <p className="text-muted-foreground">保存日志未观察到</p>}{r.ambiguousCalls > 0 && <p className="mt-1 text-amber-700">有重名待归属</p>}</td>
    <td className="p-3"><p>成功 {count("loaded")} · 失败 {count("error")}</p><p className="text-muted-foreground">待确认 {count("returned")} · 无结果 {count("pending")}</p></td>
    <td className="max-w-72 p-3"><Badge variant="outline" className={r.effectiveness.state === "passed" ? "text-emerald-700" : r.effectiveness.state === "failed" ? "text-red-600" : "text-muted-foreground"}>{resultLabels[r.effectiveness.state]}</Badge><p className="mt-2 text-muted-foreground">{r.effectiveness.detail}</p>{r.effectiveness.receipt && <div className="mt-2 space-y-1"><p>场景：{r.effectiveness.receipt.scenario}</p><p>检查：{r.effectiveness.receipt.validator.name}</p><p>{date(r.effectiveness.receipt.validator.finishedAt)}</p></div>}</td>
  </tr>;
}
