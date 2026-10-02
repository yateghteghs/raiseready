import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import { imageDimensions, MAX_IMAGE_BYTES, ownsImagePath, validateImage } from "@/lib/images/rules";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

describe("validateImage", () => {
  it("accepts PNG and JPEG by their content", () => {
    expect(validateImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toMatchObject({ ok: true, ext: "png" });
    expect(validateImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ ok: true, ext: "jpg" });
  });

  it("rejects SVG, GIF, empty and oversized files", () => {
    expect(validateImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toMatchObject({ ok: false });
    expect(validateImage(new TextEncoder().encode("GIF89a"))).toMatchObject({ ok: false });
    expect(validateImage(new Uint8Array())).toMatchObject({ ok: false, message: /empty/ });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateImage(big)).toMatchObject({ ok: false, message: /2 MB/ });
  });
});

describe("ownsImagePath", () => {
  it("only accepts paths inside the owner's folder", () => {
    expect(ownsImagePath("u1/avatar-x.png", "u1")).toBe(true);
    expect(ownsImagePath("u2/avatar-x.png", "u1")).toBe(false);
    expect(ownsImagePath("u1/../u2/a.png", "u1")).toBe(false);
    expect(ownsImagePath(null, "u1")).toBe(false);
  });
});

describe("imageDimensions", () => {
  it("reads PNG and JPEG sizes from their headers", () => {
    const png = readFileSync(path.join(process.cwd(), "lib/reports/assets/indexprima-logo.png"));
    expect(imageDimensions(png)).toEqual({ width: 635, height: 120 });
    const jpeg = Buffer.from(readFileSync(path.join(process.cwd(), "test/fixtures/37x21.jpg")));
    expect(imageDimensions(jpeg)).toEqual({ width: 37, height: 21 });
  });

  it("gives up on truncated or broken files instead of looping", () => {
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
