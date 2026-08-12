import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'assets/iiif-mark.splat');
const splats = [];

function box([minX, minY, minZ], [maxX, maxY, maxZ], color) {
  const spacing = 0.055;
  for (let x = minX; x <= maxX + spacing / 2; x += spacing) {
    for (let y = minY; y <= maxY + spacing / 2; y += spacing) {
      for (let z = minZ; z <= maxZ + spacing / 2; z += spacing) {
        splats.push({ position: [x, y, z], scale: [0.045, 0.045, 0.045], color });
      }
    }
  }
}

const red = [237, 28, 36, 245];
const white = [245, 245, 245, 245];
for (const center of [-1.4, -0.75, -0.1]) {
  box([center - 0.09, -0.82, -0.11], [center + 0.09, 0.82, 0.11], red);
  box([center - 0.24, 0.72, -0.11], [center + 0.24, 0.92, 0.11], red);
  box([center - 0.24, -0.92, -0.11], [center + 0.24, -0.72, 0.11], red);
}
box([0.42, -0.92, -0.11], [0.62, 0.92, 0.11], white);
box([0.42, -0.92, -0.11], [1.65, -0.72, 0.11], white);
box([0.42, -0.18, -0.11], [1.42, 0.02, 0.11], white);

const data = Buffer.alloc(splats.length * 32);
for (const [index, splat] of splats.entries()) {
  const offset = index * 32;
  splat.position.forEach((value, axis) => data.writeFloatLE(value, offset + axis * 4));
  splat.scale.forEach((value, axis) => data.writeFloatLE(value, offset + 12 + axis * 4));
  splat.color.forEach((value, channel) => data.writeUInt8(value, offset + 24 + channel));
  data.set([255, 128, 128, 128], offset + 28);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, data);
console.log(`Generated ${splats.length} deterministic Gaussian splats (${data.byteLength} bytes).`);
