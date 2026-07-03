import { useEffect, useMemo, useRef, useState } from 'react';
import { useManifest } from './useManifest';
import { useCanvas } from './useCanvas';
import { useVaultEffect } from './useVaultEffect';
import { ImageCandidate, ImageCandidateRequest } from '@iiif/helpers/image-service';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { createThumbnailHelper } from '@iiif/helpers/thumbnail';
import { useVault } from './useVault';
import { getId, imageServiceRequestToString, parseImageServiceRequest } from '@iiif/parser/image-3';

export function getCroppedThumbnail(
  thumbnail: any,
  request: ImageCandidateRequest
): ImageCandidate | undefined {
  try {
    const id = getId(thumbnail);

    if (!id) {
      return undefined;
    }

    const imageRequest = parseImageServiceRequest(id);
    const regionWidth = imageRequest.type === 'image' ? imageRequest.region.w : undefined;
    const regionHeight = imageRequest.type === 'image' ? imageRequest.region.h : undefined;
    const sourceWidth = regionWidth || thumbnail.width;
    const sourceHeight = regionHeight || thumbnail.height;
    const width = request.width || request.maxWidth;
    const height = request.height || request.maxHeight;

    if (imageRequest.type !== 'image' || imageRequest.region.full || imageRequest.region.square) {
      return undefined;
    }

    if (width || height) {
      imageRequest.size = {
        max: false,
        upscaled: false,
        confined: !!(width && height),
        width,
        height,
        version: 3,
      };
    }

    const ratio =
      sourceWidth && sourceHeight && (width || height)
        ? Math.min(width ? width / sourceWidth : Infinity, height ? height / sourceHeight : Infinity)
        : undefined;

    return {
      id: imageServiceRequestToString(imageRequest),
      type: 'fixed',
      width:
        sourceWidth && ratio
          ? Math.round(sourceWidth * ratio)
          : width || sourceWidth || thumbnail.width || 0,
      height:
        sourceHeight && ratio
          ? Math.round(sourceHeight * ratio)
          : height || sourceHeight || thumbnail.height || 0,
    };
  } catch {
    return undefined;
  }
}

export function useThumbnail(
  request: ImageCandidateRequest,
  dereference?: boolean,
  { canvasId, manifestId }: { canvasId?: string; manifestId?: string } = {}
) {
  const vault = useVault();
  const loader = useImageServiceLoader();
  const helper = useMemo(() => createThumbnailHelper(vault, { imageServiceLoader: loader }), [vault, loader]);

  const [thumbnail, setThumbnail] = useState<ImageCandidate | undefined>();
  const manifest = useManifest(manifestId ? { id: manifestId } : undefined);
  const canvas = useCanvas(canvasId ? { id: canvasId } : undefined);
  const subject = canvas ? canvas : manifest;
  const didUnmount = useRef(false);

  useEffect(() => {
    didUnmount.current = false;
    return () => {
      didUnmount.current = true;
    };
  }, []);

  if (!subject) {
    throw new Error('Must be called under a manifest or canvas context.');
  }

  useVaultEffect(
    (v) => {
      if (subject.type === 'Canvas' && subject.thumbnail?.length) {
        const cropped = getCroppedThumbnail(v.get(subject.thumbnail[0]), request);

        if (cropped && !didUnmount.current) {
          setThumbnail(cropped);
          return;
        }
      }

      helper.getBestThumbnailAtSize(subject, request, dereference).then((thumb) => {
        if (thumb.best && !didUnmount.current) {
          setThumbnail(thumb.best);
        }
      });
    },
    [
      subject,
      request.width,
      request.height,
      request.maxWidth,
      request.maxHeight,
      request.minWidth,
      request.minHeight,
      request.allowUnsafe,
      request.unsafeImageService,
      request.preferFixedSize,
      dereference,
    ]
  );

  return thumbnail;
}
