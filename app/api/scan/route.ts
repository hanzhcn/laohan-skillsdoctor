import { NextResponse } from "next/server";
import { scan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(scan());
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 },
    );
  }
}
