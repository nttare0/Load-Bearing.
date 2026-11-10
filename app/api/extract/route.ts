import { extractPdfText, extractDocxText, htmlToText } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 400_000;
const MAX_CHARS = 24_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "No file in the request." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return Response.json({ error: "That file is too large for v1. Paste the key section instead." }, { status: 413 });
      }

      const name = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (name.endsWith(".pdf")) {
        const text = await extractPdfText(buffer);
        if (!text.trim()) {
          return Response.json(
            { error: "That PDF has no selectable text — it may be a scan. Paste the text instead." },
            { status: 422 }
          );
        }
        return Response.json({ text: text.slice(0, MAX_CHARS) });
      }

      if (name.endsWith(".docx")) {
        const text = await extractDocxText(buffer);
        if (!text.trim()) {
          return Response.json({ error: "That document appears to be empty." }, { status: 422 });
        }
        return Response.json({ text: text.slice(0, MAX_CHARS) });
      }

      return Response.json({ text: buffer.toString("utf8").slice(0, MAX_CHARS) });
    }

    const body = (await request.json()) as { url?: string };
    if (!body.url) return Response.json({ error: "No URL given." }, { status: 400 });

    let target: URL;
    try {
      target = new URL(body.url);
    } catch {
      return Response.json({ error: "That is not a valid URL." }, { status: 400 });
    }
    if (!/^https?:$/.test(target.protocol)) {
      return Response.json({ error: "Only http and https URLs can be read." }, { status: 400 });
    }
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/i.test(target.hostname)) {
      return Response.json({ error: "That host is not allowed." }, { status: 400 });
    }

    const response = await fetch(target, {
      headers: { "User-Agent": "Load-Bearing/1.0 (plan analysis; contact via site)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return Response.json({ error: `The page returned ${response.status}.` }, { status: 422 });
    }

    const html = await response.text();
    const text = htmlToText(html).slice(0, MAX_CHARS);
    if (text.trim().length < 80) {
      return Response.json(
        { error: "That page has almost no readable text — it may be rendered by JavaScript." },
        { status: 422 }
      );
    }
    return Response.json({ text, title: extractTitle(html) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Could not read that input (${message.slice(0, 100)}).` }, { status: 500 });
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]{1,200}?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}
