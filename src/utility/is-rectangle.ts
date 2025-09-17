import type { InputShape } from 'polygon-editor';

export function isRectangle(points: InputShape['points']) {
  const maxX = Math.max(...points.map((point) => point[0]));
  const minX = Math.min(...points.map((point) => point[0]));
  const maxY = Math.max(...points.map((point) => point[1]));
  const minY = Math.min(...points.map((point) => point[1]));

  for (const point of points) {
    // Check if the point is on the boundary
    if (point[0] !== minX && point[0] !== maxX && point[1] !== minY && point[1] !== maxY) {
      return false;
    }

    // Check if the point is within the min/max x and y
    if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
      return false;
    }
  }

  return true;
}
