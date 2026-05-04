import { NextResponse } from "next/server";
import { deleteFolder, updateFolder } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  updateFolder(id, {
    name: body.name,
    parentId: body.parentId === undefined ? undefined : body.parentId
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = deleteFolder(id);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
