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
