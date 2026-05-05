import { NextResponse } from "next/server";
import { reorderPinnedBookmarks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body.ids) || body.ids.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ message: "缺少有效的排序列表。" }, { status: 400 });
  }
  reorderPinnedBookmarks(body.ids);
  return NextResponse.json({ ok: true });
}
