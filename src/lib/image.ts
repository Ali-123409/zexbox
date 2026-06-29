/**
 * Image URL optimization helper
 *
 * Safe to import from both client and server components.
 */

/**
 * Optimize an image URL using Aliyun OSS params.
 * MovieBox uses ?x-oss-process=image/resize,w_X/format,webp for responsive images.
 *
 * Only optimizes aoneroom CDN URLs (others returned unchanged).
 */
export function optimizeImage(url: string | undefined, width = 540): string | undefined {
  if (!url) return undefined;
  if (url.includes("x-oss-process")) return url;
  if (!url.includes("aoneroom.com") && !url.includes("hakunaymatata")) return url;
  return `${url}?x-oss-process=image/resize,w_${width}/format,webp`;
}
