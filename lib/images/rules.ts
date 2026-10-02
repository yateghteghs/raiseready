/** Profile pictures and company logos: private bucket, PNG or JPEG, up to 2 MB. */

export const IMAGES_BUCKET = "images";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/png,image/jpeg";

export type ImageKind = "avatar" | "logo";
type ImageType = { mime: "image/png" | "image/jpeg"; ext: "png" | "jpg" };

export type ImageCheck = ({ ok: true } & ImageType) | { ok: false; message: string };

/**
 * Checks an image by its content, not its name (spec 8). Only PNG and JPEG
 * are accepted: SVG can carry scripts, and the PDF renderer reads only these.
 */
export function validateImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, message: "That file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, message: "Images must be 2 MB or smaller." };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return { ok: true, mime: "image/png", ext: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true, mime: "image/jpeg", ext: "jpg" };
  return { ok: false, message: "Use a PNG or JPEG image." };
}

/**
 * Whether a stored path belongs to this owner. Paths are only ever written by
 * server code, but signed links are created only after this check too.
 */
export function ownsImagePath(path: string | null | undefined, ownerId: string): path is string {
  return Boolean(path && path.startsWith(`${ownerId}/`) && !path.includes(".."));
}

/**
 * Width and height of a PNG or JPEG, read from its header, or null if they
 * can't be found. Bounded: walks JPEG segments without trusting lengths past
 * the end of the file.
 */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const check = validateImage(bytes);
  if (!check.ok) return null;
  const u16 = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  if (check.mime === "image/png") {
    if (bytes.length < 24) return null;
    const u32 = (i: number) => ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
    const width = u32(16);
    const height = u32(20);
    return width && height ? { width, height } : null;
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Start-of-frame markers carry the size; C4, C8 and CC are not frames.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16(i + 5);
      const width = u16(i + 7);
      return width && height ? { width, height } : null;
    }
    const length = u16(i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}
