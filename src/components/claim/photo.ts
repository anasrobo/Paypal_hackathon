/**
 * Photo preparation, in the browser.
 *
 * Three jobs:
 *
 *   1. DECODE. An iPhone hands over a HEIC file that a desktop browser cannot
 *      paint onto a canvas. The HEIC decoder is loaded ONLY on that path, so
 *      a normal JPEG never pays for it.
 *
 *   2. DOWNSCALE. A modern phone camera produces a 12 megapixel file. Sending
 *      that is slow for the person on a bad connection, and it is wasteful for
 *      a price tag. The photo is scaled so its longest edge is at most 1600 px
 *      and re-encoded as JPEG at quality 0.82 — typically 250–400 KB.
 *
 *   3. PREVIEW. The person must SEE the photo they are about to submit. A
 *      preview is not a nicety; it is the difference between submitting the
 *      right picture and a blurry one.
 *
 * The ORIGINAL byte size is reported separately from the processed one, and it
 * is the ORIGINAL size the gate's "under 10 MB" rule is evaluated against.
 * Downscaling is a transport decision, never a way to slip past a rule.
 */

export interface PreparedPhoto {
  blob: Blob;
  mime: string;
  /** The size of the file the user actually chose, before any processing. */
  originalBytes: number;
  /** The size of the blob that will be uploaded. */
  bytes: number;
  width: number;
  height: number;
  /** An object URL for the preview. The caller revokes it. */
  previewUrl: string;
}

const MAX_EDGE = 1600;
const QUALITY = 0.82;
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

function isHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Convert a HEIC file to a JPEG.
 *
 * The decoder is imported dynamically and only when it is actually needed, so
 * it never ends up in the critical path of a normal photo. If it is missing
 * or fails, the caller gets a clear error rather than a blank canvas.
 */
async function convertHeic(file: File): Promise<Blob> {
  const heicModule = await import("heic2any");
  const convert = heicModule.default;
  const result = await convert({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!blob) throw new Error("This image could not be converted from HEIC.");
  return blob;
}

async function loadImage(source: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(source);
  const image = new Image();
  image.src = url;
  await image.decode();
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    release: () => URL.revokeObjectURL(url),
  };
}

/**
 * Prepare a photo for upload.
 *
 * The processing never fails the submission: if the canvas cannot be used for
 * some reason, the original file is uploaded unchanged. A worse photo is
 * better than no photo.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const originalBytes = file.size;

  let source: Blob = file;
  if (isHeic(file)) {
    source = await convertHeic(file);
  }

  try {
    const image = await loadImage(source);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    image.draw(ctx, width, height);
    image.release();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", QUALITY);
    });
    if (!blob) throw new Error("no blob");

    return {
      blob,
      mime: "image/jpeg",
      originalBytes,
      bytes: blob.size,
      width,
      height,
      previewUrl: URL.createObjectURL(blob),
    };
  } catch {
    // Fall back to the original file.
    return {
      blob: file,
      mime: file.type || "image/jpeg",
      originalBytes,
      bytes: file.size,
      width: 0,
      height: 0,
      previewUrl: URL.createObjectURL(file),
    };
  }
}

/**
 * Draw a plausible price-tag photo.
 *
 * This is the disclosed demo fixture. It exists so the whole money path can be
 * demonstrated on a laptop, with no camera and no permission prompt, and so
 * the automated end-to-end test has something deterministic to submit.
 *
 * It is clearly labelled as a fixture in the UI. It is never used by the
 * server: the server judges the bytes it receives, and the mock vision
 * provider is deterministic by design.
 */
export async function makeDemoPhoto(
  expectedValueCents: number,
  sku: string,
): Promise<PreparedPhoto> {
  const width = 1200;
  const height = 900;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the demo fixture.");

  // A shelf.
  ctx.fillStyle = "#e9e6e0";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#cfc9bf";
  ctx.fillRect(0, 0, width, 150);
  ctx.fillStyle = "#d8d2c8";
  ctx.fillRect(0, 620, width, 40);
  ctx.fillStyle = "#b9b1a4";
  ctx.fillRect(0, 660, width, 240);

  // The price tag.
  const tagX = 300;
  const tagY = 250;
  const tagW = 600;
  const tagH = 280;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = "#1b1f26";
  ctx.lineWidth = 4;
  ctx.strokeRect(tagX, tagY, tagW, tagH);

  ctx.fillStyle = "#1b1f26";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(`SKU ${sku}`, tagX + 36, tagY + 70);

  ctx.font = "700 120px ui-monospace, monospace";
  ctx.fillText(
    `$${(expectedValueCents / 100).toFixed(2)}`,
    tagX + 36,
    tagY + 200,
  );

  ctx.fillStyle = "#6b7280";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText("GROUNDTRUTH DEMO FIXTURE", tagX + 36, tagY + 250);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", QUALITY);
  });
  if (!blob) throw new Error("The demo fixture could not be rendered.");

  return {
    blob,
    mime: "image/jpeg",
    originalBytes: blob.size,
    bytes: blob.size,
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
  };
}
