/** Small telescope/sensor calculators ported from useless-astro's tools pages. */

export interface FovResult {
  fRatio: number;
  magnification: number;
  trueFovDeg: number;
  trueFovArcmin: number;
  exitPupilMm: number;
}

/** Eyepiece-based telescope field of view and magnification (useless-astro's fov.astro). */
export function computeEyepieceFov(apertureMm: number, focalLengthMm: number, eyepieceFlMm: number, apparentFovDeg: number): FovResult | null {
  if (!apertureMm || !focalLengthMm || !eyepieceFlMm) return null;
  const fRatio = focalLengthMm / apertureMm;
  const magnification = focalLengthMm / eyepieceFlMm;
  const trueFovDeg = apparentFovDeg / magnification;
  const exitPupilMm = apertureMm / magnification;
  return { fRatio, magnification, trueFovDeg, trueFovArcmin: trueFovDeg * 60, exitPupilMm };
}

export interface PlateScaleResult {
  arcsecPerPixel: number;
  sensorWidthMm: number;
  sensorHeightMm: number;
  fovWidthArcmin: number;
  fovHeightArcmin: number;
  samplingKey: "oversampled" | "wellMatched" | "slightlyUndersampled" | "undersampled";
}

/** Camera plate scale and field of view (useless-astro's plate-scale.astro). */
export function computePlateScale(
  focalLengthMm: number,
  pixelSizeUm: number,
  widthPx: number,
  heightPx: number,
): PlateScaleResult | null {
  if (!focalLengthMm || !pixelSizeUm || !widthPx || !heightPx) return null;
  const arcsecPerPixel = (206.265 * pixelSizeUm) / focalLengthMm;
  const sensorWidthMm = (pixelSizeUm * widthPx) / 1000;
  const sensorHeightMm = (pixelSizeUm * heightPx) / 1000;
  const fovWidthArcmin = (arcsecPerPixel * widthPx) / 60;
  const fovHeightArcmin = (arcsecPerPixel * heightPx) / 60;
  let samplingKey: PlateScaleResult["samplingKey"];
  if (arcsecPerPixel < 1) samplingKey = "oversampled";
  else if (arcsecPerPixel <= 2) samplingKey = "wellMatched";
  else if (arcsecPerPixel <= 3) samplingKey = "slightlyUndersampled";
  else samplingKey = "undersampled";
  return { arcsecPerPixel, sensorWidthMm, sensorHeightMm, fovWidthArcmin, fovHeightArcmin, samplingKey };
}

/** Format arcminutes as "D° M.M′" once over 60′, else "M.M′" (useless-astro's arcminToDMString). */
export function formatArcminAsDM(totalArcmin: number): string {
  if (totalArcmin >= 60) {
    const deg = Math.floor(totalArcmin / 60);
    const rem = totalArcmin - deg * 60;
    return `${deg}° ${rem.toFixed(1)}′`;
  }
  return `${totalArcmin.toFixed(1)}′`;
}

export type DistanceUnit = "km" | "au" | "ls" | "lm" | "ly" | "pc";

const KM_PER_AU = 149597870.7;
const KM_PER_LS = 299792.458;
const C_KM_S = 299792.458;
const SECONDS_PER_YEAR = 365.25 * 86400;
const KM_PER_LY = C_KM_S * SECONDS_PER_YEAR;
const KM_PER_PC = KM_PER_LY * 3.26156378;

const KM_PER_UNIT: Record<DistanceUnit, number> = {
  km: 1,
  au: KM_PER_AU,
  ls: KM_PER_LS,
  lm: KM_PER_LS * 60,
  ly: KM_PER_LY,
  pc: KM_PER_PC,
};

export const DISTANCE_UNITS: DistanceUnit[] = ["km", "au", "ls", "lm", "ly", "pc"];

/** Convert a distance value from one astronomical unit to every other one (useless-astro's distances.astro). */
export function convertDistance(value: number, fromUnit: DistanceUnit): Record<DistanceUnit, number> {
  const km = value * KM_PER_UNIT[fromUnit];
  const out = {} as Record<DistanceUnit, number>;
  for (const unit of DISTANCE_UNITS) out[unit] = km / KM_PER_UNIT[unit];
  return out;
}

export interface MagnitudeComparison {
  diff: number;
  fluxRatioAB: number;
  fluxRatioBA: number;
  brighter: "A" | "B" | "equal";
}

/** Compare two magnitudes as flux ratios via the Pogson relation (useless-astro's magnitude.astro). */
export function compareMagnitudes(magA: number, magB: number): MagnitudeComparison {
  const diff = magA - magB;
  const fluxRatioAB = Math.pow(10, -diff / 2.5);
  return {
    diff,
    fluxRatioAB,
    fluxRatioBA: 1 / fluxRatioAB,
    brighter: diff === 0 ? "equal" : diff < 0 ? "A" : "B",
  };
}

/** Inverse of {@link compareMagnitudes}: a flux ratio to the magnitude difference it implies. */
export function magnitudeDiffFromFluxRatio(ratio: number): number | null {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return 2.5 * Math.log10(ratio);
}
