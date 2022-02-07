import { InternationalString } from '@iiif/presentation-3';

export type SingleChoice = {
  type: 'single-choice';
  label?: InternationalString;
  items: Array<{
    id: string;
    label?: InternationalString;
    selected?: true;
  }>;
};

export type ComplexChoice = {
  type: 'complex-choice';
  items: SingleChoice[];
};

export type ChoiceDescription = SingleChoice | ComplexChoice;
