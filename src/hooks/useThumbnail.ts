import { useEffect, useMemo, useRef, useState } from 'react';
import { useManifest } from './useManifest';
import { useCanvas } from './useCanvas';
import { useVaultEffect } from './useVaultEffect';
import { ImageCandidate, ImageCandidateRequest } from '@atlas-viewer/iiif-image-api';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { createThumbnailHelper } from '@iiif/vault-helpers/thumbnail';
import { useVault } from './useVault';

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
    return () => {
      didUnmount.current = true;
    };
  }, []);

  if (!subject) {
    throw new Error('Must be called under a manifest or canvas context.');
  }

  useVaultEffect(
    (v) => {
      helper.getBestThumbnailAtSize(subject, request, dereference).then((thumb) => {
        if (thumb.best && !didUnmount.current) {
          setThumbnail(thumb.best);
        }
      });
    },
    [subject]
  );

  return thumbnail;
}
