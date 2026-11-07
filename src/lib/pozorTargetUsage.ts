export type TargetUsage = Record<string, number>;

const storageKey = (userId: string) => `pozor_target_usage_v1:${userId}`;

/** Usage stays scoped to the signed-in observer and this browser. */
export function readTargetUsage(userId: string): TargetUsage {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, count]) =>
      typeof count === "number" && Number.isSafeInteger(count) && count > 0,
    ));
  } catch {
    return {};
  }
}

export function recordTargetUsage(userId: string, targetIds: string[]): void {
  const usage = readTargetUsage(userId);
  for (const id of new Set(targetIds)) usage[id] = (usage[id] ?? 0) + 1;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(usage));
  } catch {
    // Planning remains available when browser storage is disabled.
  }
}

export function mostUsedTargets<T extends { id: string }>(targets: T[], usage: TargetUsage): T[] {
  return targets
    .filter((target) => (usage[target.id] ?? 0) > 0)
    .sort((a, b) => usage[b.id] - usage[a.id] || a.id.localeCompare(b.id))
    .slice(0, 6);
}