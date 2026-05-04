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
  const folder = createFolder({ name: body.name, parentId: body.parentId ?? null });
  return NextResponse.json({ folder }, { status: 201 });
}
