// Client-only image downscaler. Loads a picked image, draws it onto a canvas
// bounded to a max edge, and re-encodes it as JPEG -- so a straight-from-camera
// phone photo (often 8-12 MB and 4000px+) becomes a ~200-500 KB web image
// before it's uploaded. Two wins: the upload is fast and always well under the
// bucket's size limit, and a heavy original never has to travel anywhere.
//
// Browser-only: it uses createImageBitmap / <img> / <canvas>, so only ever call
// it from a client component or event handler. It THROWS when the browser can't
// decode the input (e.g. an iPhone HEIC on Chrome) -- callers catch that and
// show a format message rather than silently failing.

export type DownscaleOptions = {
  /** Longest-edge cap in CSS pixels. The image is only ever scaled down. */
  maxEdge?: number;
  /** JPEG quality, 0..1. */
  quality?: number;
};

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Decode a File to something drawable, honouring EXIF orientation. Prefers
 *  createImageBitmap (fast, off-main-thread, orientation-aware); falls back to
 *  an <img> tag. Rejects if the browser can't decode the format. */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image-decode-failed"));
      el.src = url;
    });
    // The element holds the decoded pixels now, so revoking the URL here is safe.
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale + re-encode `file` to a JPEG File no larger than `maxEdge` on its
 * longest side. A transparent source (e.g. a PNG) is matted onto white so it
 * doesn't turn black under JPEG. Throws on an undecodable input.
 */
export async function downscaleImageToJpeg(
  file: File,
  { maxEdge = 1600, quality = 0.82 }: DownscaleOptions = {}
): Promise<File> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("image-encode-failed");

    const base = file.name.replace(/\.[^./\\]+$/, "").trim() || "image";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    img.close();
  }
}
