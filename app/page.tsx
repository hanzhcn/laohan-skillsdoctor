"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw, Stethoscope } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OriginBadge, HealthBadges } from "@/components/badges";
import { SkillDetail } from "@/components/skill-detail";
import { ORIGIN_META } from "@/lib/origin-meta";
import type { ScanResult, Skill, Origin, PathInfo } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch("/api/scan")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const skills = data?.skills ?? [];
  const summary = data?.summary;
  const issues = summary?.healthIssues;

  const cnt = (os: Origin[]) =>
    skills.filter((s) => os.includes(s.origin)).length;
  const issueCnt = skills.filter(
    (s) => Object.keys(s.health).length > 0,
  ).length;

  const tabs: { key: string; label: string; filter: (s: Skill) => boolean }[] =
    [
      { key: "all", label: `全部 ${skills.length}`, filter: () => true },
      {
        key: "self",
        label: `自研 ${cnt(["self-laohan", "self-cheat"])}`,
        filter: (s) =>
          s.origin === "self-laohan" || s.origin === "self-cheat",
      },
      {
        key: "dbskill",
        label: `dbskill ${summary?.byOrigin.dbskill ?? 0}`,
        filter: (s) => s.origin === "dbskill",
      },
      {
        key: "tool-managed",
        label: `工具管理 ${summary?.byOrigin["tool-managed"] ?? 0}`,
        filter: (s) => s.origin === "tool-managed",
      },
      {
        key: "governed",
        label: `治理 ${summary?.byOrigin.governed ?? 0}`,
        filter: (s) => s.origin === "governed",
      },
      {
        key: "npx",
        label: `npx ${summary?.byOrigin.npx ?? 0}`,
        filter: (s) => s.origin === "npx",
      },
      {
        key: "plugin",
        label: `插件副本 ${summary?.byOrigin.plugin ?? 0}`,
        filter: (s) => s.origin === "plugin",
      },
      {
        key: "openclaw",
        label: `OpenClaw ${summary?.byOrigin.openclaw ?? 0}`,
        filter: (s) => s.origin === "openclaw",
      },
      {
        key: "orphan",
        label: `孤儿 ${summary?.byOrigin.orphan ?? 0}`,
        filter: (s) => s.origin === "orphan",
      },
      {
        key: "issues",
        label: `健康问题 ${issueCnt}`,
        filter: (s) => Object.keys(s.health).length > 0,
      },
    ];

  const open = (name: string) => {
    setSelected(name);
    setDetailOpen(true);
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold">skill-doctor</h1>
            <p className="text-sm text-muted-foreground">
              Claude Code / OpenClaw skill 体检仪表盘
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw
            className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          刷新
        </Button>
      </header>

      {err && <div className="mb-4 text-red-600">错误: {err}</div>}

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(
            [
              "self-laohan",
              "self-cheat",
              "dbskill",
              "tool-managed",
              "governed",
              "npx",
              "plugin",
              "openclaw",
              "orphan",
            ] as Origin[]
          ).map((o) => (
            <Card key={o}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {ORIGIN_META[o].label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.byOrigin[o]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {issues && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {issueCnt === 0 ? (
            <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700">
              ✅ 无健康问题
            </Badge>
          ) : (
            <Card className="flex flex-wrap gap-3 p-3 text-sm">
              <span className="font-medium">🟡 健康问题：</span>
              {issues.duplicateCopy > 0 && (
                <span>插件副本 {issues.duplicateCopy}</span>
              )}
              {issues.drift > 0 && <span>漂移 {issues.drift}</span>}
              {issues.dangling > 0 && (
                <span className="text-red-600">
                  失效链接 {issues.dangling}
                </span>
              )}
              {issues.dualEntity > 0 && (
                <span>双份实体 {issues.dualEntity}</span>
              )}
              {issues.notInCC > 0 && (
                <span className="text-red-600">
                  CC不可见 {issues.notInCC}
                </span>
              )}
              {issues.brokenLink > 0 && (
                <span className="text-orange-600">
                  链断副本 {issues.brokenLink}
                </span>
              )}
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.key === "plugin" ? (
              <PluginGroups skills={skills.filter(t.filter)} onOpen={open} />
            ) : (
              <SkillTable skills={skills.filter(t.filter)} onOpen={open} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <SkillDetail
        name={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </main>
  );
}

function SkillTable({
  skills,
  onOpen,
}: {
  skills: Skill[];
  onOpen: (n: string) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[26%]">name</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>agents</TableHead>
            <TableHead>claude</TableHead>
            <TableHead>codex</TableHead>
            <TableHead>健康</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((s) => (
            <TableRow
              key={s.name}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onOpen(s.name)}
            >
              <TableCell className="font-mono text-xs">{s.name}</TableCell>
              <TableCell>
                <OriginBadge origin={s.origin} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                <PathCell p={s.agents} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                <PathCell p={s.claude} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                <PathCell p={s.codex} />
              </TableCell>
              <TableCell>
                <HealthBadges skill={s} />
              </TableCell>
            </TableRow>
          ))}
          {skills.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-muted-foreground"
              >
                无
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PathCell({ p }: { p: PathInfo }): ReactNode {
  if (p.state === "absent")
    return <span className="text-muted-foreground">—</span>;
  if (p.state === "symlink")
    return (
      <span className={p.exists ? "text-blue-600" : "text-red-600"}>
        symlink{!p.exists ? " ⚠失效" : ""}
      </span>
    );
  return <span className="text-emerald-600">real</span>;
}

function PluginGroups({
  skills,
  onOpen,
}: {
  skills: Skill[];
  onOpen: (n: string) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of skills) {
      const k = s.originDetail?.plugin ?? "unknown";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [skills]);
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted-foreground">
        按插件分组，ECC（261）默认折叠，点展开
      </p>
      {groups.map(([plugin, sks]) => (
        <details
          key={plugin}
          open={!plugin.startsWith("ecc")}
          className="rounded-lg border"
        >
          <summary className="cursor-pointer px-4 py-2 font-mono text-sm hover:bg-muted/50">
            {plugin}{" "}
            <span className="text-muted-foreground">({sks.length})</span>
          </summary>
          <SkillTable skills={sks} onOpen={onOpen} />
        </details>
      ))}
    </div>
  );
}
