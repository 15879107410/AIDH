import { NextResponse } from "next/server";
import { deleteBookmark, updateBookmark } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const bookmark = updateBookmark(id, body);
  if (!bookmark) return NextResponse.json({ message: "收藏不存在。" }, { status: 404 });
  return NextResponse.json({ bookmark });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteBookmark(id);
  return NextResponse.json({ ok: true });
}
