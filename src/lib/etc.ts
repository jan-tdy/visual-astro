/**
 * Exposure Time Calculator (ETC) math, ported from the bombol.space /etc/ tool.
 * Estimates per-frame and stacked SNR for a CCD/CMOS observation from telescope,
 * sensor, sky and target parameters, in three modes:
 *  - "point": a point source (star) measured through an aperture, with aperture
 *    photometry encircled-energy (EE) correction.
 *  - "broadband": an extended (surface-brightness) target through a broadband filter.
 *  - "narrow": an extended target measured by emission-line flux through a
 *    narrowband filter (Hα, [OIII], [SII]).
 */

/** Photometric zero-points (electrons/s/m² for a mag-0 source), point-source filters. */
export const POINT_FILTERS: Record<string, number> = {
  U: 4e9, B: 7e9, V: 1.1e10, Rc: 2e10, Ic: 1.5e10,
  u: 3.6e9, g: 9.1e9, r: 1.4e10, i: 1.2e10, z: 8e9,
};

/** Zero-points for broadband (RGB/L) extended-source filters. */
export const BROADBAND_FILTERS: Record<string, number> = {
  L: 1.5e10, R: 1.2e10, G: 1.1e10, B: 9e9,
};

/** Central wavelength (nm) and reference bandwidth (nm) for narrowband filters. */
export const NARROWBAND_FILTERS: Record<string, { lambda: number; bw: number }> = {
  Ha: { lambda: 656.3, bw: 3 },
  OIII: { lambda: 500.7, bw: 3 },
  SII: { lambda: 672.4, bw: 3 },
};

/** Extinction coefficients (mag/airmass), kept separate per mode since "B" means a
 *  different filter (and a different coefficient) in the point vs. broadband sets. */
export const POINT_EXTINCTION: Record<string, number> = {
  U: 0.45, B: 0.25, V: 0.15, Rc: 0.10, Ic: 0.08,
  u: 0.35, g: 0.20, r: 0.12, i: 0.08, z: 0.05,
};
export const BROADBAND_EXTINCTION: Record<string, number> = {
  L: 0.15, R: 0.12, G: 0.15, B: 0.20,
};
const DEFAULT_EXTINCTION = 0.15;

/** Reference bandwidth (nm) and V-band zero-point used to scale sky brightness into a narrowband. */
const REF_BW_NM = 90;
const ZP_V = POINT_FILTERS.V;

const PLANCK_H = 6.626e-34;
const SPEED_OF_LIGHT = 2.998e8;

export type EtcMode = "point" | "broadband" | "narrow";

export interface EtcCommonInputs {
  /** Telescope aperture diameter, in meters. */
  diameterM: number;
  /** Total optical + QE throughput, 0-1. */
  throughput: number;
  /** Pixel scale, arcsec/pixel. */
  pixScaleArcsecPerPix: number;
  /** Read noise, electrons/pixel. */
  readNoiseE: number;
  /** Dark current, electrons/pixel/second. */
  darkCurrentEPerPixPerSec: number;
  /** Seeing FWHM, arcsec. */
  seeingArcsec: number;
  /** Photometry aperture radius, arcsec. Defaults to 0.7 * seeing when null. */
  apertureRadiusArcsec: number | null;
  /** Exposure time per frame, seconds. */
  expTimeSec: number;
  /** Number of stacked frames. */
  nExp: number;
  /** Sky brightness, V-band mag/arcsec². */
  skyMagPerArcsec2: number;
  /** Airmass (1.0 = zenith). */
  airmass: number;
}

export interface EtcPointInputs {
  mode: "point";
  magnitude: number;
  filter: string;
}

export interface EtcBroadbandInputs {
  mode: "broadband";
  surfaceMagPerArcsec2: number;
  filter: string;
}

export interface EtcNarrowbandInputs {
  mode: "narrow";
  /** Emission-line flux, erg/s/cm²/arcsec². */
  lineFluxErgCm2SArcsec2: number;
  filter: string;
  /** Optional bandwidth override, nm (falls back to the filter's reference bandwidth). */
  bandwidthOverrideNm: number | null;
}

export type EtcModeInputs = EtcPointInputs | EtcBroadbandInputs | EtcNarrowbandInputs;

export interface EtcResult {
  apertureRadiusArcsec: number;
  apertureAreaArcsec2: number;
  telescopeAreaM2: number;
  sourceElectronsPerFrame: number;
  skyElectronsPerFrame: number;
  darkElectronsPerFrame: number;
  readNoiseVariancePerFrame: number;
  noisePerFrame: number;
  snrPerFrame: number;
  snrStacked: number;
  snrPerArcsec2PerFrame: number;
  snrPerArcsec2Stacked: number;
  noteKey: "point" | "broadband" | "narrow";
}

export class EtcError extends Error {}

/** Mirrors the original tool's unknown-filter errors, used by the UI to show a translated message. */
export function unknownFilterError(filter: string): EtcError {
  return new EtcError(`Unknown filter ${filter}`);
}

export function computeExposure(common: EtcCommonInputs, modeInputs: EtcModeInputs): EtcResult {
  const {
    diameterM, throughput, pixScaleArcsecPerPix, readNoiseE, darkCurrentEPerPixPerSec,
    seeingArcsec, apertureRadiusArcsec, expTimeSec, nExp, skyMagPerArcsec2, airmass,
  } = common;

  const telescopeAreaM2 = Math.PI * (diameterM / 2) ** 2;
  const ap = apertureRadiusArcsec ?? 0.7 * seeingArcsec;
  const apArea = Math.PI * ap * ap;
  const npix = apArea / (pixScaleArcsecPerPix * pixScaleArcsecPerPix);
  const sigma = seeingArcsec / 2.355;
  const encircledEnergy = 1 - Math.exp(-(ap * ap) / (2 * sigma * sigma));

  let sourceElectronsPerFrame: number;
  let skyElectronsPerFrame: number;

  if (modeInputs.mode === "point") {
    const zp = POINT_FILTERS[modeInputs.filter];
    if (zp === undefined) throw unknownFilterError(modeInputs.filter);
    const k = POINT_EXTINCTION[modeInputs.filter] ?? DEFAULT_EXTINCTION;
    const flux = zp * Math.pow(10, -0.4 * (modeInputs.magnitude + k * (airmass - 1)));
    sourceElectronsPerFrame = flux * telescopeAreaM2 * throughput * expTimeSec * encircledEnergy;
    const skyFlux = zp * Math.pow(10, -0.4 * (skyMagPerArcsec2 + k * (airmass - 1)));
    skyElectronsPerFrame = skyFlux * telescopeAreaM2 * throughput * expTimeSec * apArea;
  } else if (modeInputs.mode === "broadband") {
    const zp = BROADBAND_FILTERS[modeInputs.filter];
    if (zp === undefined) throw unknownFilterError(modeInputs.filter);
    const k = BROADBAND_EXTINCTION[modeInputs.filter] ?? DEFAULT_EXTINCTION;
    const flux = zp * Math.pow(10, -0.4 * (modeInputs.surfaceMagPerArcsec2 + k * (airmass - 1)));
    sourceElectronsPerFrame = flux * telescopeAreaM2 * throughput * expTimeSec * apArea;
    const skyFlux = zp * Math.pow(10, -0.4 * (skyMagPerArcsec2 + k * (airmass - 1)));
    skyElectronsPerFrame = skyFlux * telescopeAreaM2 * throughput * expTimeSec * apArea;
  } else {
    const filterDef = NARROWBAND_FILTERS[modeInputs.filter];
    if (filterDef === undefined) throw unknownFilterError(modeInputs.filter);
    const bw = modeInputs.bandwidthOverrideNm ?? filterDef.bw;
    const lambdaM = filterDef.lambda * 1e-9;
    const photonFlux = (modeInputs.lineFluxErgCm2SArcsec2 * 1e-3 * lambdaM) / (PLANCK_H * SPEED_OF_LIGHT);
    // There's no per-narrowband-filter extinction table, so this approximates all three
    // (Ha/[OIII]/[SII]) with the V-band coefficient — applied to the source too, not just
    // the sky, so SNR doesn't incorrectly improve as airmass rises.
    const k = POINT_EXTINCTION.V;
    const extinctionFactor = Math.pow(10, -0.4 * k * (airmass - 1));
    sourceElectronsPerFrame = photonFlux * telescopeAreaM2 * throughput * expTimeSec * apArea * extinctionFactor;

    const skyFlux = ZP_V * Math.pow(10, -0.4 * (skyMagPerArcsec2 + k * (airmass - 1))) * (bw / REF_BW_NM);
    skyElectronsPerFrame = skyFlux * telescopeAreaM2 * throughput * expTimeSec * apArea;
  }

  const darkElectronsPerFrame = darkCurrentEPerPixPerSec * expTimeSec * npix;
  const readNoiseVariancePerFrame = readNoiseE * readNoiseE * npix;
  const noisePerFrame = Math.sqrt(
    sourceElectronsPerFrame + skyElectronsPerFrame + darkElectronsPerFrame + readNoiseVariancePerFrame,
  );
  const snrPerFrame = noisePerFrame > 0 ? sourceElectronsPerFrame / noisePerFrame : 0;
  const snrStacked = Math.sqrt(Math.max(1, nExp)) * snrPerFrame;

  const sourceSbPerFrame = sourceElectronsPerFrame / apArea;
  const skySbPerFrame = skyElectronsPerFrame / apArea;
  const pix2 = pixScaleArcsecPerPix * pixScaleArcsecPerPix;
  const noiseSbPerFrame = Math.sqrt(
    sourceSbPerFrame + skySbPerFrame
      + (darkCurrentEPerPixPerSec * expTimeSec) / pix2
      + (readNoiseE * readNoiseE) / pix2,
  );
  const snrPerArcsec2PerFrame = noiseSbPerFrame > 0 ? sourceSbPerFrame / noiseSbPerFrame : 0;
  const snrPerArcsec2Stacked = Math.sqrt(Math.max(1, nExp)) * snrPerArcsec2PerFrame;

  return {
    apertureRadiusArcsec: ap,
    apertureAreaArcsec2: apArea,
    telescopeAreaM2,
    sourceElectronsPerFrame,
    skyElectronsPerFrame,
    darkElectronsPerFrame,
    readNoiseVariancePerFrame,
    noisePerFrame,
    snrPerFrame,
    snrStacked,
    snrPerArcsec2PerFrame,
    snrPerArcsec2Stacked,
    noteKey: modeInputs.mode,
  };
}

const ARCSEC_PER_RADIAN = (180 * 3600) / Math.PI;

/**
 * Angular size <-> linear (physical) size at a given distance — the other half of
 * "how big will this look", complementing the SNR estimate above. Exact (not
 * small-angle) relation: linearSize = 2 * distance * tan(angularSize / 2).
 */
export function angularToLinearSize(distanceKm: number, angularSizeArcsec: number): number {
  const angleRad = angularSizeArcsec / ARCSEC_PER_RADIAN;
  return 2 * distanceKm * Math.tan(angleRad / 2);
}

/** Inverse of {@link angularToLinearSize}: linearSize = 2 * distance * tan(angularSize / 2)
 *  solved for the angle, returned in arcsec. */
export function linearToAngularSize(distanceKm: number, linearSizeKm: number): number {
  const angleRad = 2 * Math.atan(linearSizeKm / (2 * distanceKm));
  return angleRad * ARCSEC_PER_RADIAN;
}
