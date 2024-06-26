// This works inside of a manifest context
// Final API to be decided, but this hook will be for driving search querying itself
// Another hook/context will handle actually getting the search results for a particular canvas
import { useManifest } from './useManifest';
import { SearchService } from '@iiif/presentation-3';
import { ServiceNormalized } from '@iiif/presentation-3-normalized';

export function useSearchService(): SearchService | undefined {
  const manifest = useManifest();
  return manifest
    ? (manifest.service.find(
        (service: ServiceNormalized) =>
          (service as any).profile === 'SearchService1' ||
          (service as any).profile === 'http://iiif.io/api/search/1/search'
      ) as any)
    : undefined;
}
