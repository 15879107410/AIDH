import { NextResponse } from "next/server";
import { canonicalBookmarkUrl, listFolders } from "@/lib/db";
import type { AiPreview } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";

const known = [
  {
    match: "jimeng.jianying.com",
    title: "即梦 AI",
    description: "字节旗下 AI 创作工具，支持文生图、图生图和视频生成，适合 AIGC 内容制作。",
    tags: ["生图", "生视频", "AIGC", "字节"],
    folder: "生图视频",
    confidence: 0.94
  },
  {
    match: "midjourney.com",
    title: "Midjourney",
    description: "高质量图片生成工具，适合视觉探索、海报、概念图和品牌灵感发散。",
    tags: ["生图", "设计", "灵感"],
    folder: "生图视频",
    confidence: 0.91
  },
  {
    match: "krea.ai",
    title: "Krea",
    description: "实时生成与图片增强工具，适合快速探索视觉方向和优化素材。",
    tags: ["生图", "实时生成", "设计"],
    folder: "生图视频",
    confidence: 0.88
  },
  {
    match: "openai.com",
    title: "OpenAI",
    description: "AI 模型、API 与研究平台，适合跟踪模型能力、开发文档和产品更新。",
    tags: ["模型", "API", "Agent"],
    folder: "编程",
    confidence: 0.9
  }
];

function flattenFolders(nodes: ReturnType<typeof listFolders>): { id: string; name: string }[] {
  return nodes.flatMap((node) => [{ id: node.id, name: node.name }, ...flattenFolders(node.children)]);
}

function fallbackPreview(url: string): AiPreview {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/^www\./, "");
  const match = known.find((item) => domain.includes(item.match));
  const folderOptions = flattenFolders(listFolders());
  const suggestedFolder = folderOptions.find((folder) => folder.name === match?.folder) ?? null;
  const title = match?.title ?? domain.split(".")[0].replace(/^\w/, (char) => char.toUpperCase());
  return {
    title,
    url: parsed.origin,
    logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    description: match?.description ?? `${domain} 的网页收藏。AI 会根据网页内容自动生成更准确的简介和标签。`,
    tags: match?.tags ?? ["待整理", "网页", "收藏"],
    suggestedFolderId: suggestedFolder?.id ?? null,
    suggestedFolderName: suggestedFolder?.name ?? null,
    confidence: match?.confidence ?? 0.56,
    source: "mock"
  };
}

async function deepseekPreview(url: string): Promise<AiPreview> {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/^www\./, "");
  const folderOptions = flattenFolders(listFolders());
  const schemaHint = {
    title: "string",
    description: "string",
    tags: ["string"],
    suggestedFolderName: "string | null",
    confidence: 0.0
  };
  const systemPrompt = [
    "You are a bookmark classification assistant.",
    "Return ONLY valid JSON.",
    "Normalize all URLs to the site homepage origin.",
    "Suggest a folder name only from the provided folder list, or null if none fits.",
    "Keep descriptions short and practical.",
    `Available folders: ${folderOptions.map((folder) => folder.name).join(", ")}`,
    `Output schema example: ${JSON.stringify(schemaHint)}`
  ].join(" ");
  const userPrompt = [
    `URL: ${parsed.origin}`,
    `Domain: ${domain}`,
    "Classify this website for a bookmark manager.",
    "Prefer concise Chinese output.",
    "Return JSON with keys: title, description, tags, suggestedFolderName, confidence."
  ].join("\n");

  const response = await fetch(`${DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("DeepSeek returned empty content");
  }

  const payload = JSON.parse(content) as {
    title?: string;
    description?: string;
    tags?: string[];
    suggestedFolderName?: string | null;
    confidence?: number;
  };
  const suggestedFolder = payload.suggestedFolderName
    ? folderOptions.find((folder) => folder.name === payload.suggestedFolderName) ?? null
    : null;

  return {
    title: payload.title?.trim() || domain,
    url: parsed.origin,
    logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    description: payload.description?.trim() || `${domain} 的网页收藏。`,
    tags: Array.isArray(payload.tags) && payload.tags.length ? payload.tags.slice(0, 8) : ["待整理", "网页", "收藏"],
    suggestedFolderId: suggestedFolder?.id ?? null,
    suggestedFolderName: suggestedFolder?.name ?? null,
    confidence: typeof payload.confidence === "number" ? payload.confidence : 0.7,
    source: "deepseek"
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.url?.trim()) {
    return NextResponse.json({ message: "URL 不能为空。" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(canonicalBookmarkUrl(body.url));
  } catch {
    return NextResponse.json({ message: "请输入有效 URL。" }, { status: 400 });
  }

  try {
    const preview = DEEPSEEK_API_KEY ? await deepseekPreview(parsed.origin) : fallbackPreview(parsed.origin);
    return NextResponse.json({ preview });
  } catch (error) {
    const preview = fallbackPreview(parsed.origin);
    return NextResponse.json({
      preview,
      message: error instanceof Error ? error.message : "DeepSeek 调用失败，已降级到本地规则。"
    });
  }
}
