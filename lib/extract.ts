import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Text extraction with no dependencies: just enough PDF and DOCX reading to
 * get a pasted-in plan out of the common file formats.
 *
 * Deliberately conservative. If the text cannot be read, say so rather than
 * handing the model a wall of mojibake — a bad extraction produces confident
 * nonsense, which is the one thing this tool must not do.
 */

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const raw = buffer.toString("latin1");
  const pieces: string[] = [];

  // "stream" must be followed by CRLF or LF, and we read to the matching
  // "endstream". Filters (ASCII85, Flate) are applied in the order the object
  // dictionary declares them, which is how ReportLab-produced PDFs are written.
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const content = decodeStream(match[1]);
    if (!content) continue;

    // Text-showing operators: (string) Tj and [(a)(b)] TJ
    const textBits = content.match(/\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ/g);
    if (!textBits) continue;

    let chunk = "";
    for (const bit of textBits) {
      chunk += decodePdfStrings(bit);
      chunk += " ";
    }
    if (chunk.trim()) pieces.push(chunk.trim());
  }

  // Fall back to any uncompressed camera-ready text.
  if (pieces.length === 0) {
    const textBits = raw.match(/\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ/g);
    if (textBits) {
      for (const bit of textBits) pieces.push(decodePdfStrings(bit));
    }
  }

  return tidy(pieces.join("\n\n"));
}

/** Undo whichever filters a stream uses. Returns "" if nothing readable. */
function decodeStream(body: string): string {
  let data: Buffer = Buffer.from(body, "latin1");

  const trimmed = body.trim();
  if (trimmed.endsWith("~>")) {
    const decoded = ascii85Decode(trimmed);
    if (decoded) data = decoded;
  } else if (/^[0-9a-fA-F\s]+>?$/.test(trimmed.slice(0, 64)) && trimmed.endsWith(">")) {
    const decoded = asciiHexDecode(trimmed);
    if (decoded) data = decoded;
  }

  for (const inflate of [inflateSync, inflateRawSync]) {
    try {
      return inflate(data).toString("latin1");
    } catch {
      // try the next one
    }
  }

  // Some streams are stored with /FlateDecode but no zlib header — try the
  // raw body once more before giving up and treating it as plain text.
  const text = data.toString("latin1");
  return /\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ/.test(text) ? text : "";
}

function ascii85Decode(input: string): Buffer | null {
  const clean = input.replace(/\s+/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const out: number[] = [];
  let group: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === "z" && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const code = char.charCodeAt(0) - 33;
    if (code < 0 || code > 84) return null;
    group.push(code);
    if (group.length === 5) {
      let value = 0;
      for (const digit of group) value = value * 85 + digit;
      out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
      group = [];
    }
  }

  if (group.length > 0) {
    const padding = 5 - group.length;
    while (group.length < 5) group.push(84);
    let value = 0;
    for (const digit of group) value = value * 85 + digit;
    const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    out.push(...bytes.slice(0, 4 - padding));
  }

  return out.length ? Buffer.from(out) : null;
}

function asciiHexDecode(input: string): Buffer | null {
  const clean = input.replace(/[^0-9a-fA-F]/g, "");
  if (!clean.length) return null;
  const even = clean.length % 2 === 0 ? clean : `${clean}0`;
  return Buffer.from(even, "hex");
}

function decodePdfStrings(chunk: string): string {
  const strings = chunk.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
  return strings
    .map((s) =>
      s
        .slice(1, -1)
        .replace(/\\([nrtbf])/g, (_m, c: string) => {
          const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "", f: "" };
          return escapes[c] ?? "";
        })
        .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, "$1")
    )
    .join("");
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const raw = buffer.toString("latin1");
  const pieces: string[] = [];
  const regex = /stream\r?\n?([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    try {
      const xml = inflateRawSync(Buffer.from(match[1], "latin1")).toString("utf8");
      if (!/<w:t[\s>]/.test(xml)) continue;

      const paragraphs = xml.split(/<\/w:p>/);
      for (const paragraph of paragraphs) {
        const texts = Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map((m) =>
          decodeXml(m[1])
        );
        if (texts.length) pieces.push(texts.join(""));
      }
    } catch {
      // Not a compressed document part; skip it.
    }
  }

  return tidy(pieces.join("\n\n"));
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Rough, readable HTML-to-text. Good enough to analyse a pasted plan. */
export function htmlToText(html: string): string {
  return tidy(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
