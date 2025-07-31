export function targetIntersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const { x, y, width, height } = a;
  const { x: viewportX, y: viewportY } = b;
  const { width: viewportWidth, height: viewportHeight } = b;
  return (
    x + width > viewportX && x < viewportX + viewportWidth && y + height > viewportY && y < viewportY + viewportHeight
  );
}
