// Shared color scale for the GitHub-style contribution heatmaps (year + night tabs).
// Level 0 = no observations, levels 1-4 = increasing intensity relative to the max
// count in the current view, mirrored via CSS var opacity so it stays theme-aware.
export const HEATMAP_LEVEL_ALPHA = [0, 0.22, 0.42, 0.65, 1] as const;

export function heatmapLevel(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

export function heatmapCellColor(count: number, max: number): string {
  const level = heatmapLevel(count, max);
  return level === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${HEATMAP_LEVEL_ALPHA[level]})`;
}
