import { InternationalString } from '@iiif/presentation-3';

export interface SingleChoice {
  type: 'single-choice';
  label?: InternationalString;
  items: Array<{
    id: string;
    label?: InternationalString;
    selected?: true;
  }>;
}

export interface ComplexChoice {
  type: 'complex-choice';
  items: SingleChoice[];
}

export type ChoiceDescription = SingleChoice | ComplexChoice;
