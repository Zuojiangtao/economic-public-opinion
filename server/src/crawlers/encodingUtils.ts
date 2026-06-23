import { createRequire } from 'node:module';
const iconv = createRequire(import.meta.url)('iconv-lite');
import * as cheerio from 'cheerio';

/**
 * 从 HTML 内容中检测 charset，支持 <meta charset="..."> 和
 * <meta http-equiv="Content-Type" content="text/html; charset=...">
 */
export function detectCharset(html: string): string {
  // 尝试从 cheerio 解析的 meta 标签中获取
  const $ = cheerio.load(html);
  const charsetMeta = $('meta[charset]').attr('charset');
  if (charsetMeta) return charsetMeta.toUpperCase().trim();

  const contentTypeMeta = $('meta[http-equiv="Content-Type"]').attr('content');
  if (contentTypeMeta) {
    const match = contentTypeMeta.match(/charset=([^\s;]+)/i);
    if (match) return match[1].toUpperCase().trim();
  }

  // 兜底：尝试从原始字符串中正则匹配（当 cheerio 因乱码无法解析 meta 时）
  const rawMatch = html.match(/charset=["']?([^\s;"']+)/i);
  if (rawMatch) return rawMatch[1].toUpperCase().trim();

  return 'UTF-8';
}

/**
 * 将 ArrayBuffer 按 HTML 中声明的 charset 正确解码为 UTF-8 字符串。
 * 若 charset 为 GB2312/GBK/GB18030 等，会通过 iconv-lite 转码；
 * 若为 UTF-8 或无法检测，则直接 TextDecoder 解码。
 */
export function decodeHtmlBuffer(buffer: ArrayBuffer, fallbackCharset?: string): string {
  // 先用 UTF-8 尝试解码，用于检测 charset
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

  const charset = fallbackCharset || detectCharset(utf8Text);

  if (charset === 'UTF-8' || charset === 'UTF8') {
    return utf8Text;
  }

  // GB2312/GBK/GB18030 等，通过 iconv-lite 解码
  if (iconv.encodingExists(charset)) {
    const buf = Buffer.from(buffer);
    return iconv.decode(buf, charset);
  }

  // 不支持的编码，回退 UTF-8
  console.warn(`[encodingUtils] Unknown charset "${charset}", falling back to UTF-8`);
  return utf8Text;
}
