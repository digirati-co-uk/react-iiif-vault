import { InternationalString } from '@iiif/presentation-3';
import { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { AnnotationPageDescription } from './resource-types';
import { getParsedTargetSelector } from './rendering-utils';
import { RenderingStrategy } from './strategies';
import { ChoiceDescription, Paintables, SupportedTarget } from '@iiif/vault-helpers';

export type TextualContentStrategy = {
  type: 'textual-content';
  items: { annotationId: string; text: InternationalString; target: SupportedTarget | null }[];
  choice?: ChoiceDescription; // future
  annotations?: AnnotationPageDescription; // future
};

function parseType(item: any, languageMap: InternationalString = {}, lang?: string) {
  const language = item.language || lang || 'none';
  switch (item.type) {
    case 'TextualBody': {
      if (typeof item.value !== 'undefined') {
        languageMap[language] = item.value;
      }
      break;
    }
    case 'List':
    case 'Composite':
    case 'Choice': {
      if (item.items) {
        item.items.forEach((inner: any) => parseType(inner, languageMap, language));
      }
    }
  }
  return languageMap;
}

export function getTextualContentStrategy(canvas: CanvasNormalized, paintables: Paintables): RenderingStrategy {
  const items: TextualContentStrategy['items'] = [];

  paintables.items.forEach((item) => {
    if (item.resource) {
      const [target] = getParsedTargetSelector(canvas, item.target);
      items.push({ annotationId: item.annotationId, text: parseType(item.resource), target: target as any });
    }
  });

  return {
    type: 'textual-content',
    items,
  } as TextualContentStrategy;
}
