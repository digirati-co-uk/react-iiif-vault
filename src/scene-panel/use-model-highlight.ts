import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { Color, Object3D, type Material } from 'three';

export function parseModelHighlightColor(value: string) {
  let style = value.trim();
  let opacity = 0.3;
  const functional = style.match(/^rgba?\((.*)\)$/i)?.[1];
  if (functional) {
    const [channels, alpha] = functional.split('/').map((part) => part.trim());
    const colorChannels = channels.includes(',')
      ? channels.split(',').map((part) => part.trim())
      : channels.split(/\s+/);
    const alphaValue = alpha || (colorChannels.length === 4 ? colorChannels.pop() : undefined);
    if (alphaValue) opacity = alphaValue.endsWith('%') ? Number.parseFloat(alphaValue) / 100 : Number(alphaValue);
    style = `rgb(${colorChannels.join(',')})`;
  } else if (/^#[\da-f]{8}$/i.test(style)) {
    opacity = Number.parseInt(style.slice(7), 16) / 255;
    style = style.slice(0, 7);
  } else if (/^#[\da-f]{4}$/i.test(style)) {
    opacity = Number.parseInt(`${style[4]}${style[4]}`, 16) / 255;
    style = style.slice(0, 4);
  }
  return {
    color: new Color().setStyle(style),
    opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0.3,
  };
}

type MaterialObject = Object3D & { material: Material | Material[] };
type TintableMaterial = Material & { color?: Color; emissive?: Color; emissiveIntensity?: number };

export function useModelHighlight(object: Object3D, value: false | string) {
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    if (!value) return;
    const tint = parseModelHighlightColor(value);
    const replacements: Array<{
      object: MaterialObject;
      original: Material | Material[];
      highlighted: Material[];
    }> = [];
    object.traverse((child) => {
      if (!('material' in child) || !child.material) return;
      const materialObject = child as MaterialObject;
      const original = materialObject.material;
      const materials = Array.isArray(original) ? original : [original];
      const highlighted = materials.map((material) => {
        const copy = material.clone() as TintableMaterial;
        copy.color?.lerp(tint.color, tint.opacity);
        if (copy.emissive) {
          copy.emissive.lerp(tint.color, tint.opacity);
          copy.emissiveIntensity = Math.max(copy.emissiveIntensity || 0, 1);
        }
        copy.needsUpdate = true;
        return copy;
      });
      materialObject.material = Array.isArray(original) ? highlighted : highlighted[0];
      replacements.push({ object: materialObject, original, highlighted });
    });
    invalidate();
    return () => {
      for (const replacement of replacements) {
        replacement.object.material = replacement.original;
        for (const material of replacement.highlighted) material.dispose();
      }
      invalidate();
    };
  }, [invalidate, object, value]);
}
