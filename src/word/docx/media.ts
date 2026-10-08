// Imagens do .docx (word/media) como data URL.

import JSZip from "jszip";

export const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp" };

export async function loadMedia(zip: JSZip, rels: Map<string, { target: string; external: boolean }>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const [id, rel] of rels) {
    if (rel.external) continue;
    const ext = rel.target.split(".").pop()?.toLowerCase() ?? "";
    if (!MIME[ext]) continue;
    const path = rel.target.startsWith("/") ? rel.target.slice(1) : `word/${rel.target.replace(/^\.\//, "")}`;
    const file = zip.file(path);
    if (!file) continue;
    out.set(id, `data:${MIME[ext]};base64,${await file.async("base64")}`);
  }
  return out;
}
