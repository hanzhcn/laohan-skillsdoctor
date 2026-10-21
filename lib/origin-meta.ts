import type { Origin, Health } from "./types";

export const ORIGIN_META: Record<
  Origin,
  { label: string; badge: string; group: string }
> = {
  "self-laohan": {
    label: "自研·laohan",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    group: "自研",
  },
  "self-cheat": {
    label: "自研·cheat",
    badge:
      "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    group: "自研",
  },
  dbskill: {
    label: "dbskill",
    badge:
      "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    group: "dbskill",
  },
  "tool-managed": {
    label: "工具管理",
    badge:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    group: "工具管理",
  },
  openclaw: {
    label: "OpenClaw",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    group: "OpenClaw",
  },
  npx: {
    label: "npx",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    group: "npx",
  },
  plugin: {
    label: "插件副本",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    group: "插件",
  },
  orphan: {
    label: "⚠️ 孤儿",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    group: "孤儿",
  },
};

export const HEALTH_META: Record<
  keyof Omit<Health, never>,
  { label: string; badge: string }
> = {
  duplicateCopy: {
    label: "插件副本",
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  drift: {
    label: "漂移",
    badge: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  },
  dangling: {
    label: "失效链接",
    badge: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  dualEntity: {
    label: "双份实体",
    badge: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  },
  notInCC: {
    label: "CC不可见",
    badge: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  brokenLink: {
    label: "链断副本",
    badge: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  },
};

export function healthItems(h: Health) {
  const items: { key: keyof Health; label: string; detail?: string }[] = [];
  if (h.duplicateCopy)
    items.push({
      key: "duplicateCopy",
      label: "插件副本",
      detail: `${h.duplicateCopy.plugin.split("@")[0]} · ${
        h.duplicateCopy.identical ? "逐字一致" : "有差异"
      }`,
    });
  if (h.drift)
    items.push({
      key: "drift",
      label: "漂移",
      detail: `${h.drift.diffLines} 行差异`,
    });
  if (h.dangling) items.push({ key: "dangling", label: "失效链接" });
  if (h.dualEntity) items.push({ key: "dualEntity", label: "双份实体" });
  if (h.notInCC) items.push({ key: "notInCC", label: "CC不可见" });
  if (h.brokenLink)
    items.push({ key: "brokenLink", label: "链断副本" });
  return items;
}
