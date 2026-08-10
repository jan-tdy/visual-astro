// Splits a paper-scan photo into a 2x2 grid of crops before sending each one
// to the paper-ocr edge function. This exists for two reasons: the physical
// paper template is routinely two-column (see paperTemplatePdf.ts), so a
// smaller per-crop image keeps the model's JSON output well clear of any
// truncation limit, and each crop becomes its own edge function invocation
// with its own fresh connection budget instead of one call that has to OCR
// the whole page — a busy night (50+ rows in a single half) has been
// observed to run past the platform's connection limit even split in two,
// so four smaller crops give more margin.
const OVERLAP_RATIO = 0.03;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function cropToDataUrl(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// Order matches paper-ocr's splitPositionLabel: 1=top-left, 2=top-right,
// 3=bottom-left, 4=bottom-right.
export async function splitImageIntoQuadrants(dataUrl: string): Promise<[string, string, string, string]> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const halfW = Math.round(w / 2);
  const halfH = Math.round(h / 2);
  const overlapX = Math.round(w * OVERLAP_RATIO);
  const overlapY = Math.round(h * OVERLAP_RATIO);

  const leftW = Math.min(w, halfW + overlapX);
  const rightX = Math.max(0, halfW - overlapX);
  const rightW = w - rightX;
  const topH = Math.min(h, halfH + overlapY);
  const bottomY = Math.max(0, halfH - overlapY);
  const bottomH = h - bottomY;

  const topLeft = cropToDataUrl(img, 0, 0, leftW, topH);
  const topRight = cropToDataUrl(img, rightX, 0, rightW, topH);
  const bottomLeft = cropToDataUrl(img, 0, bottomY, leftW, bottomH);
  const bottomRight = cropToDataUrl(img, rightX, bottomY, rightW, bottomH);
  return [topLeft, topRight, bottomLeft, bottomRight];
}
