import { NextResponse } from "next/server";
import { reorderPinnedBookmarks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body.ids) || body.ids.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ message: "缺少有效的排序列表。" }, { status: 400 });
  }
  try {
    reorderPinnedBookmarks(body.ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCK_LIMIT_REACHED") {
      return NextResponse.json({ message: "Dock 区域已经满了，最多只能放 20 个常用网址。" }, { status: 400 });
    }
    throw error;
  }
}
