import { NextResponse } from "next/server";
import { canonicalBookmarkUrl, deleteBookmark, recordBookmarkVisit, updateBookmark } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (body.url) {
    try {
      body.url = canonicalBookmarkUrl(body.url);
    } catch {
      return NextResponse.json({ message: "请输入有效 URL。" }, { status: 400 });
    }
  }
  try {
    const bookmark = updateBookmark(id, body);
    if (!bookmark) return NextResponse.json({ message: "收藏不存在。" }, { status: 404 });
    return NextResponse.json({ bookmark });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCK_LIMIT_REACHED") {
      return NextResponse.json({ message: "Dock 区域已经满了，最多只能放 20 个常用网址。" }, { status: 400 });
    }
    throw error;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookmark = recordBookmarkVisit(id);
  if (!bookmark) return NextResponse.json({ message: "收藏不存在。" }, { status: 404 });
  return NextResponse.json({ bookmark });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteBookmark(id);
  return NextResponse.json({ ok: true });
}
