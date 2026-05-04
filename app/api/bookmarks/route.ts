import { NextResponse } from "next/server";
import { createBookmark, listBookmarks } from "@/lib/db";

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
    new URL(body.url);
  } catch {
    return NextResponse.json({ message: "请输入有效 URL。" }, { status: 400 });
  }
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
}
