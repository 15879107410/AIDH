import { NextResponse } from "next/server";
import { listFolders } from "@/lib/db";

export const dynamic = "force-dynamic";

const known = [
  {
    match: "jimeng.jianying.com",
    title: "即梦 AI",
    description: "字节旗下 AI 创作工具，支持文生图、图生图和视频生成，适合 AIGC 内容制作。",
    tags: ["生图", "生视频", "AIGC", "字节"],
    folder: "生图生视频",
    confidence: 0.94
  },
  {
    match: "midjourney.com",
    title: "Midjourney",
    description: "高质量图片生成工具，适合视觉探索、海报、概念图和品牌灵感发散。",
    tags: ["生图", "设计", "灵感"],
    folder: "生图生视频",
    confidence: 0.91
  },
  {
    match: "krea.ai",
    title: "Krea",
    description: "实时生成与图片增强工具，适合快速探索视觉方向和优化素材。",
    tags: ["生图", "实时生成", "设计"],
    folder: "生图生视频",
    confidence: 0.88
  },
  {
    match: "openai.com",
    title: "OpenAI",
    description: "AI 模型、API 与研究平台，适合跟踪模型能力、开发文档和产品更新。",
    tags: ["模型", "API", "Agent"],
    folder: "Agent / 编程",
    confidence: 0.9
  }
];

function flattenFolders(nodes: ReturnType<typeof listFolders>): { id: string; name: string }[] {
  return nodes.flatMap((node) => [{ id: node.id, name: node.name }, ...flattenFolders(node.children)]);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.url?.trim()) {
    return NextResponse.json({ message: "URL 不能为空。" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ message: "请输入有效 URL。" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 650));
  const domain = parsed.hostname.replace(/^www\./, "");
  const match = known.find((item) => domain.includes(item.match));
  const folderOptions = flattenFolders(listFolders());
  const suggestedFolder = folderOptions.find((folder) => folder.name === match?.folder) ?? null;
  const title = match?.title ?? domain.split(".")[0].replace(/^\w/, (char) => char.toUpperCase());

  return NextResponse.json({
    preview: {
      title,
      logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      description: match?.description ?? `${domain} 的网页收藏。AI 第二阶段接入后会根据网页内容自动生成更准确的简介和标签。`,
      tags: match?.tags ?? ["待整理", "网页", "收藏"],
      suggestedFolderId: suggestedFolder?.id ?? null,
      suggestedFolderName: suggestedFolder?.name ?? null,
      confidence: match?.confidence ?? 0.56,
      source: "mock"
    }
  });
}
