// Splits a paper-scan photo into left/right halves before sending each half
// to the paper-ocr edge function. This exists for two reasons: the physical
// paper template is routinely two-column (see paperTemplatePdf.ts), so a
// smaller per-half image keeps the model's JSON output well clear of any
// truncation limit, and each half becomes its own edge function invocation
// with its own fresh wall-clock budget instead of one call that has to OCR
// the whole page.
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

export async function splitImageIntoHalves(dataUrl: string): Promise<[string, string]> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const half = Math.round(w / 2);
  const overlap = Math.round(w * OVERLAP_RATIO);

  const leftW = Math.min(w, half + overlap);
  const rightX = Math.max(0, half - overlap);
  const rightW = w - rightX;

  const left = cropToDataUrl(img, 0, 0, leftW, h);
  const right = cropToDataUrl(img, rightX, 0, rightW, h);
  return [left, right];
}
