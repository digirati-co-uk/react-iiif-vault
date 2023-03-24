import {
  AnnotationNormalized,
  CanvasNormalized,
  ContentResource,
  IIIFExternalWebResource,
  PointSelector,
  SpecificResource,
  W3CAnnotationTarget,
} from '@iiif/presentation-3';
import { Vault } from '@iiif/vault';
import { ChoiceDescription } from './choice-types';
import { UseRenderingStrategy } from '../../hooks/useRenderingStrategy';
import { BoxSelector, expandTarget, SupportedTarget, TemporalBoxSelector } from '@iiif/vault-helpers';

/**
 * Parse specific resource.
 *
 * This could be expanded to support pulling out more from the specific resource.
 *
 * @param resource
 */
export function parseSpecificResource(resource: ContentResource) {
  if (resource.type === 'SpecificResource') {
    console.log('SpecificResource', resource);
    return [resource.source, { selector: resource.selector }];
  }

  return [resource, { selector: null }];
}

export interface Paintables {
  choice: ChoiceDescription | null;
  types: string[];
  items: Array<{
    annotationId: string;
    type: string;
    resource: IIIFExternalWebResource | SpecificResource;
    target: any;
    selector: any;
  }>;
}

export function getPaintables(
  vault: Vault,
  paintingAnnotations: AnnotationNormalized[],
  enabledChoices: string[]
): Paintables {
  const types: string[] = [];
  let choice: Paintables['choice'] = null;
  const items: Paintables['items'] = [];

  for (const annotation of paintingAnnotations) {
    const bodies = vault.get<ContentResource>(annotation.body, { skipSelfReturn: false });

    console.log('painting bodies', {
      bodies,
      paintingAnnotations,
      t: vault.get(annotation.body[0]),
      s: vault.getState().iiif.entities.ContentResource[annotation.body[0].id],
    });

    for (const unknownBody of bodies) {
      if (!unknownBody) {
        continue;
      }

      const [body, { selector }] = parseSpecificResource(unknownBody);
      if (!body) {
        continue;
      }

      const type = (body.type || 'unknown').toLowerCase();

      // Choice
      if (type === 'choice') {
        const nestedBodies = vault.get<ContentResource>(body.items) as ContentResource[];

        // Which are active? By default the first, but we could push multiple here.
        const selected = enabledChoices.length
          ? enabledChoices.map((cid) => nestedBodies.find((b) => b.id === cid)).filter(Boolean)
          : [nestedBodies[0]];

        if (selected.length === 0) {
          selected.push(nestedBodies[0]);
        }

        // Store choice.
        choice = {
          type: 'single-choice',
          items: nestedBodies.map((b) => ({
            id: b.id,
            label: (b as any).label as any,
            selected: selected.indexOf(b) !== -1,
          })) as any[],
          label: (unknownBody as any).label,
        };

        // @todo insert in the right order.
        bodies.push(...(selected as any[]));

        continue;
      }

      if (types.indexOf(type) === -1) {
        types.push(type);
      }

      items.push({
        annotationId: annotation.id,
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
    choice,
  };
}

export function getParsedTargetSelector(
  canvas: CanvasNormalized,
  target: W3CAnnotationTarget | W3CAnnotationTarget[]
): [TemporalBoxSelector | BoxSelector | PointSelector | null, SupportedTarget['source']] {
  const { selector: imageTarget, source } = expandTarget(target);

  if (source.id !== canvas.id) {
    // Skip invalid targets.
    return [null, source];
  }

  // Target is where it should be painted.
  const defaultTarget: BoxSelector = {
    type: 'BoxSelector',
    spatial: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
  };

  return [
    imageTarget
      ? imageTarget.type === 'TemporalSelector'
        ? ({
            type: 'TemporalBoxSelector',
            temporal: imageTarget.temporal,
            spatial: defaultTarget.spatial,
          } as any)
        : imageTarget
      : null,
    source,
  ];
}

export const emptyActions = {
  makeChoice: () => {
    // no-op
  },
};

export const unknownResponse: UseRenderingStrategy[0] = { type: 'unknown' };

export const unsupportedStrategy = (reason: string): UseRenderingStrategy[0] => {
  return { type: 'unknown', reason, annotations: { pages: [] } };
};

export const emptyStrategy = (width: number, height: number): UseRenderingStrategy[0] => {
  return { type: 'empty', width, height, annotations: { pages: [] }, image: null, images: [] };
};
