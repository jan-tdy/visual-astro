/** Deterministic "pick from a list" hash, ported from useless-astro's horoscope.astro,
 *  so the same telescope name + day always produces the same horoscope. */
export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pickDeterministic<T>(arr: T[], seed: string, salt: string): T {
  const idx = hashString(`${seed}|${salt}`) % arr.length;
  return arr[idx];
}
