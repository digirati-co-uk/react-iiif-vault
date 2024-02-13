import { useManifest } from '../hooks/useManifest';
import { Metadata, MetadataProps } from './Metadata';

type ManifestMetadataProps = Omit<MetadataProps, 'metadata'>;

export function ManifestMetadata(props: ManifestMetadataProps) {
  const manifest = useManifest();

  return <Metadata metadata={manifest?.metadata || []} {...props} />;
}
