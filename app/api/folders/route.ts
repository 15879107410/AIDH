import { NextResponse } from "next/server";
import { createFolder, listFolders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ folders: listFolders() });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ message: "文件夹名称不能为空。" }, { status: 400 });
  }
  const result = createFolder({ name: body.name, parentId: body.parentId ?? null });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 409 });
  return NextResponse.json({ folder: result.folder }, { status: 201 });
}
