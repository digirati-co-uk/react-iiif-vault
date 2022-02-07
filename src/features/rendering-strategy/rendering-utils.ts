import { AnnotationNormalized, ContentResource, IIIFExternalWebResource, SpecificResource } from '@iiif/presentation-3';
import { Vault } from '@iiif/vault';

/**
 * Parse specific resource.
 *
 * This could be expanded to support pulling out more from the specific resource.
 *
 * @param resource
 */
export function parseSpecificResource(resource: ContentResource) {
  if (resource.type === 'SpecificResource') {
    return [resource.source, { selector: resource.selector }];
  }

  return [resource, { selector: null }];
}

export function getPaintables(vault: Vault, paintingAnnotations: AnnotationNormalized[]) {
  const types: string[] = [];
  const items: Array<{
    type: string;
    resource: IIIFExternalWebResource | SpecificResource;
    target: any;
    selector: any;
  }> = [];
  for (const annotation of paintingAnnotations) {
    const bodies = vault.get<ContentResource>(annotation.body);
    for (const unknownBody of bodies) {
      const [body, { selector }] = parseSpecificResource(unknownBody);
      const type = (body.type || 'unknown').toLowerCase();

      // Choice
      if (type === 'choice') {
        const nestedBodies = vault.get(body.items) as ContentResource[];
        bodies.push(nestedBodies[0]);
        continue;
        // Which are active?
      }

      if (types.indexOf(type) === -1) {
        types.push(type);
      }

      items.push({
        type: type,
        resource: body as IIIFExternalWebResource,
        target: annotation.target,
        selector,
      });
    }
  }

  return {
    types,
    items,
  };
}
