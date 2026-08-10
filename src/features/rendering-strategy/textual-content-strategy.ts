import type { InternationalString } from '@iiif/parser/presentation-3/types';
import type { AnnotationNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { AnnotationPageDescription } from './resource-types';
import { getParsedTargetSelector } from './rendering-utils';
import { RenderingStrategy } from './strategies';
import { ChoiceDescription, Paintables, SupportedTarget } from '@iiif/helpers';
import type { CompatibleCanvas } from '../../utility/canvas-compat';

export type TextualContentStrategy = {
  type: 'textual-content';
  items: TextContent[];
  choice?: ChoiceDescription; // future
  annotations?: AnnotationPageDescription; // future
};

export type TextContent = {
  type: 'Text';
  text: InternationalString;
  target: SupportedTarget | null;
  annotationId: string;
  annotation: AnnotationNormalized;
};

function parseType(item: any, languageMap: InternationalString = {}, lang?: string) {
  const language = item.language || lang || 'none';
  switch (item.type) {
    case 'TextualBody': {
      if (typeof item.value !== 'undefined') {
        languageMap[language] = [item.value];
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

export function getTextualContentStrategy(canvas: CompatibleCanvas, paintables: Paintables): RenderingStrategy {
  const items: TextualContentStrategy['items'] = [];

  paintables.items.forEach((item) => {
    if (item.resource) {
      const [target] = getParsedTargetSelector(canvas, item.target);
      items.push({
        type: 'Text',
        annotationId: item.annotationId,
        annotation: item.annotation as any,
        text: parseType(item.resource),
        target: target as any,
      });
    }
  });

  return {
    type: 'textual-content',
    items,
  } as TextualContentStrategy;
}
