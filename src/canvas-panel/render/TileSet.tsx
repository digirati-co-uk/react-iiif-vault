import type { CompositeResourceProps } from '@atlas-viewer/atlas';
import { isImageServiceLevel, isLevel0 } from '@iiif/parser/image-3';
import type { ImageService } from '@iiif/presentation-3';
import type React from 'react';
import { type ReactNode, useMemo } from 'react';

export const TileSet: React.FC<{
  tiles: {
    id: string;
    width: number;
    height: number;
    thumbnail?: { id: string; width: number; height: number };
    imageService: ImageService;
  };
  x?: number;
  y?: number;
  width: number;
  height: number;
  rotation?: number;
  crop?: any;
  children?: ReactNode;
  enableThumbnail?: boolean;
  enableSizes?: boolean;
  format?: string;
  onClick?: (e: any) => void;
  renderOptions?: CompositeResourceProps;
}> = (props) => {
  const format = props.format || 'jpg';
  const scale = props.width / (props.crop?.width || props.tiles.width);
  const sizes = props.tiles.imageService.sizes || [];
  const enableThumbnail = props.enableThumbnail;
  const enableSizes = props.enableSizes;
  const canonicalId = useMemo(() => {
    const id = props.tiles.imageService.id || (props.tiles.imageService['@id'] as string);
    if (id?.endsWith('/info.json')) {
      return id.slice(0, -1 * '/info.json'.length);
    }
    return id;
  }, [props.tiles.imageService.id, props.tiles.imageService['@id']]);

  const tiles = useMemo(() => {
    const tiles = props.tiles.imageService.tiles || [];

    if (!tiles.length) {
      const width = props.width;
      const scaleFactors = [1];
      let last = 1;
      while (2 ** last < width) {
        last = last * 2;
        scaleFactors.push(last);
      }

      if (
        (props.tiles.imageService.maxArea || props.tiles.imageService.maxWidth || props.tiles.imageService.maxHeight) &&
        isImageServiceLevel(2, props.tiles.imageService)
      ) {
        // In this case we can default to 256 I think.
        return [
          {
            width: 256,
            height: 256,
            scaleFactors,
          },
        ];
      }

      // Honestly, this is just unsafe.
      if (isImageServiceLevel(2, props.tiles.imageService)) {
        // But some image services have _no_ data.
        return [
          {
            width: 256,
            height: 256,
            scaleFactors,
          },
        ];
      }

      // Still opt-out when it's not level2.
      return [
        // {
        //   width: 256,
        //   height: 256,
        //   scaleFactors: [1, 2, 4, 8],
        // },
      ];
    }

    return tiles;
  }, [props.tiles.imageService, props.width]);

  const isVersion3 = useMemo(() => {
    const service = props.tiles.imageService;
    const ctx = service
      ? service['@context']
        ? Array.isArray(service['@context'])
          ? service['@context']
          : [service['@context']]
        : []
      : [];
    return ctx.indexOf('http://iiif.io/api/image/3/context.json') !== -1;
  }, [props.tiles.imageService.id, props.tiles.imageService]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Not dom.
    <world-object
      rotation={props.rotation}
      key={props.tiles.imageService.id}
      scale={scale}
      height={props.crop?.height || props.tiles.height}
      width={props.crop?.width || props.tiles.width}
      x={props.x}
      y={props.y}
      onClick={props.onClick}
    >
      <composite-image
        key={props.tiles.imageService.id}
        id={props.tiles.imageService.id}
        width={props.crop?.width || props.tiles.width}
        height={props.crop?.height || props.tiles.height}
        crop={props.crop}
        renderOptions={props.renderOptions}
      >
        {enableThumbnail && props.tiles.thumbnail ? (
          <world-image
            priority
            uri={props.tiles.thumbnail.id}
            target={{ width: props.tiles.width, height: props.tiles.height }}
            display={{
              width: props.tiles.thumbnail.width,
              height: props.tiles.thumbnail.height,
            }}
            crop={props.crop}
          />
        ) : null}
        {enableSizes &&
          sizes.map((size, n) => (
            <world-image
              key={n}
              uri={`${canonicalId}/full/${size.width},${isVersion3 ? size.height : ''}/0/default.${format}`}
              target={{ width: props.tiles.width, height: props.tiles.height }}
              display={{ width: size.width, height: size.height }}
              crop={props.crop}
            />
          ))}
        {tiles.map((tile: any) =>
          (tile.scaleFactors || []).map((size: number) => {
            const Component = 'tiled-image' as any;
            return (
              <Component
                key={`${props.tiles.imageService.id}-tile-${size}`}
                uri={props.tiles.imageService.id}
                display={{
                  width: props.tiles.width,
                  height: props.tiles.height,
                }}
                format={format}
                tile={tile}
                scaleFactor={size}
                crop={props.crop}
                version3={isVersion3}
              />
            );
          }),
        )}
      </composite-image>
    </world-object>
  );
};
