import { Badge } from "@/components/ui/badge";
import { ORIGIN_META, healthItems } from "@/lib/origin-meta";
import type { Origin, Skill } from "@/lib/types";

export function OriginBadge({ origin }: { origin: Origin }) {
  const m = ORIGIN_META[origin];
  return (
    <Badge variant="outline" className={`font-mono text-xs ${m.badge}`}>
      {m.label}
    </Badge>
  );
}

export function HealthBadges({ skill }: { skill: Skill }) {
  const items = healthItems(skill.health);
  if (items.length === 0)
    return <span className="text-xs text-muted-foreground">健康</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <Badge
          key={it.key}
          variant="outline"
          className={`text-xs ${it.detail ? "" : ""} bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30`}
          title={it.detail}
        >
          {it.label}
          {it.detail ? `·${it.detail}` : ""}
        </Badge>
      ))}
    </div>
  );
}
