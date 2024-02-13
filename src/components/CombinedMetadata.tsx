import { useMemo } from 'react';
import { useManifest } from '../hooks/useManifest';
import { Metadata, MetadataProps } from './Metadata';
import { useRange } from '../hooks/useRange';
import { useCanvas } from '../hooks/useCanvas';

type CombinedMetadataProps = Omit<MetadataProps, 'metadata'>;

export function CombinedMetadata(props: CombinedMetadataProps) {
  const manifest = useManifest();
  const canvas = useCanvas();
  const range = useRange();

  const metadata = useMemo(() => {
    const metadata = manifest?.metadata || [];
    const canvasMetadata = canvas?.metadata || [];
    const rangeMetadata = range?.metadata || [];

    return [...metadata, ...canvasMetadata, ...rangeMetadata];
  }, [manifest, canvas, range]);

  return <Metadata metadata={metadata} {...props} />;
}
