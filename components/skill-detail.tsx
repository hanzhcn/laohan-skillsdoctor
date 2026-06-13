"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { OriginBadge } from "@/components/badges";
import type { Skill } from "@/lib/types";

interface DetailResp {
  skill: Skill;
  drift: string | null;
  preview: string | null;
}

export function SkillDetail({
  name,
  open,
  onOpenChange,
}: {
  name: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<DetailResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !name) return;
    setLoading(true);
    setData(null);
    fetch(`/api/skill/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [open, name]);

  const s = data?.skill;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-mono">{name}</DialogTitle>
          <DialogDescription>skill 体检详情</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          {loading && <p className="text-muted-foreground">加载中…</p>}
          {s && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <OriginBadge origin={s.origin} />
                {s.originDetail?.source && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {s.originDetail.source}
                  </Badge>
                )}
                {s.originDetail?.plugin && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {s.originDetail.plugin}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div>
                  <div className="text-muted-foreground">agents</div>
                  <div>
                    {s.agents.state === "absent"
                      ? "—"
                      : `${s.agents.state}${s.agents.target ? ` → ${s.agents.target}` : ""}`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">claude</div>
                  <div>
                    {s.claude.state === "absent"
                      ? "—"
                      : `${s.claude.state}${s.claude.target ? ` → ${s.claude.target}` : ""}`}
                  </div>
                </div>
              </div>
              {s.lock && (
                <>
                  <Separator />
                  <div className="font-mono text-xs">
                    <div className="text-muted-foreground">npx 锁文件</div>
                    <div>source: {s.lock.source}</div>
                    <div>sourceUrl: {s.lock.sourceUrl}</div>
                    <div>
                      installed: {s.lock.installedAt.slice(0, 10)} · updated:{" "}
                      {s.lock.updatedAt.slice(0, 10)}
                    </div>
                  </div>
                </>
              )}
              {s.plugin && (
                <>
                  <Separator />
                  <div className="font-mono text-xs">
                    <div className="text-muted-foreground">插件原件</div>
                    <div>{s.plugin.plugin}</div>
                    <div>{s.plugin.installPath}</div>
                  </div>
                </>
              )}
              {data?.drift && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground mb-1">
                      漂移 diff（agents vs git 仓库）
                    </div>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                      {data.drift}
                    </pre>
                  </div>
                </>
              )}
              {data?.preview && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground mb-1">
                      SKILL.md 预览（前 2000 字符）
                    </div>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                      {data.preview}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
