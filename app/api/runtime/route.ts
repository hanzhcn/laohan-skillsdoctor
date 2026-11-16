import { NextResponse } from "next/server";
import { scanRuntime } from "@/lib/runtime/scan";
import { isLocalRequest } from "@/lib/runtime/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "运行证据只允许本机同源访问。" }, { status: 403 });
  }
  const days = Number(url.searchParams.get("days") ?? 30);
  if (![7, 30, 90].includes(days)) return NextResponse.json({ error: "日志范围仅支持 7、30 或 90 天。" }, { status: 400 });
  try { return NextResponse.json(await scanRuntime(days), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "运行证据扫描失败，不能据此判断技能正常。" }, { status: 500 }); }
}
