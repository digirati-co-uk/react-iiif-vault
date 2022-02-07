import { InternationalString } from '@iiif/presentation-3';
export declare type SingleChoice = {
    type: 'single-choice';
    label?: InternationalString;
    items: Array<{
        id: string;
        label?: InternationalString;
        selected?: true;
    }>;
};
export declare type ComplexChoice = {
    type: 'complex-choice';
    items: SingleChoice[];
};
export declare type ChoiceDescription = SingleChoice | ComplexChoice;
