import { NextResponse } from "next/server";
import { listBookmarks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  return NextResponse.json({ results: listBookmarks({ q }) });
}
