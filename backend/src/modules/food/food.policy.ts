export const REPEAT_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
export function isCoolingDown(lastAction: Date, now: Date) {
  return lastAction.getTime() > now.getTime() - REPEAT_WINDOW_MS;
}
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
