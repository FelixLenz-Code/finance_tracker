import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchSymbols, twelveDataConfigured } from "@/lib/twelvedata";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const configured = await twelveDataConfigured();
  if (q.length < 1) return NextResponse.json({ results: [], configured });

  try {
    const results = await searchSymbols(q);
    return NextResponse.json({ results, configured });
  } catch {
    return NextResponse.json({ results: [], configured });
  }
}
