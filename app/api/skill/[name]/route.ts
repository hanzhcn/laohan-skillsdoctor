import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { scan } from "@/lib/scanner";
import { driftDiff } from "@/lib/health";
import { PATHS } from "@/lib/paths";
import { isLocalRequest } from "@/lib/runtime/request";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!isLocalRequest(request)) return NextResponse.json({ error: "只允许本机同源访问。" }, { status: 403 });
  const { name } = await params;
  const { skills } = scan();
  const skill = skills.find((s) => s.name === name);
  if (!skill) return NextResponse.json({ error: "not found" }, { status: 404 });
  const drift = skill.health.drift ? driftDiff(name, skill.origin) : null;
  let preview: string | null = null;
  const skillMd = path.join(PATHS.agentsSkills, name, "SKILL.md");
  try {
    preview = fs.readFileSync(skillMd, "utf-8").slice(0, 2000);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ skill, drift, preview });
}
