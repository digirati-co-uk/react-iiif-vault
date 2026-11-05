export function isTemporallyVisible(time: number, temporal: { start: number; end?: number; instant?: number } | null) {
  if (!temporal) return true;
  if (temporal.instant !== undefined) return time === temporal.instant;
  return time >= temporal.start && (temporal.end === undefined || time < temporal.end);
}

export function getLocalMediaTime(
  sceneTime: number,
  interval: { start: number; end?: number } | null,
  mediaDuration: number,
  timeMode: string
) {
  const start = interval?.start || 0;
  const elapsed = Math.max(0, sceneTime - start);
  if (!mediaDuration || mediaDuration < 0) return elapsed;
  if (timeMode === 'scale' && interval?.end !== undefined && interval.end > start) {
    return Math.min(mediaDuration, (elapsed / (interval.end - start)) * mediaDuration);
  }
  if (timeMode === 'loop') return elapsed % mediaDuration;
  return Math.min(mediaDuration, elapsed);
}
