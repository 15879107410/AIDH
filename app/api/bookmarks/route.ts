import { NextResponse } from "next/server";
import { canonicalBookmarkUrl, createBookmark, listBookmarks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pinned = url.searchParams.get("pinned");
  const bookmarks = listBookmarks({
    folderId: url.searchParams.get("folderId") || undefined,
    q: url.searchParams.get("q") || undefined,
    tag: url.searchParams.get("tag") || undefined,
    pinned: pinned === null ? undefined : pinned === "true"
  });
  return NextResponse.json({ bookmarks });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.url?.trim()) {
    return NextResponse.json({ message: "URL 不能为空。" }, { status: 400 });
  }
  try {
    body.url = canonicalBookmarkUrl(body.url);
  } catch {
    return NextResponse.json({ message: "请输入有效 URL。" }, { status: 400 });
  }
  try {
    const bookmark = createBookmark({
      url: body.url,
      title: body.title || body.url,
      logoUrl: body.logoUrl || "",
      description: body.description || "",
      folderId: body.folderId ?? null,
      pinned: Boolean(body.pinned),
      tags: Array.isArray(body.tags) ? body.tags : []
    });
    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCK_LIMIT_REACHED") {
      return NextResponse.json({ message: "Dock 区域已经满了，最多只能放 20 个常用网址。" }, { status: 400 });
    }
    throw error;
  }
}
