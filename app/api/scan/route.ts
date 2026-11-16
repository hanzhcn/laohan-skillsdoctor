import { NextResponse } from "next/server";
import { scan } from "@/lib/scanner";
import { isLocalRequest } from "@/lib/runtime/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return NextResponse.json({ error: "只允许本机同源访问。" }, { status: 403 });
  try {
    return NextResponse.json(scan());
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 },
    );
  }
}
