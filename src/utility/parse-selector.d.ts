import { SupportedSelectors } from '../features/rendering-strategy/selector-extensions';
import { Selector } from '@iiif/presentation-3';
export declare type ParsedSelector = {
    selector: SupportedSelectors | null;
    selectors: SupportedSelectors[];
};
export declare function parseSelector(source: Selector | Selector[]): ParsedSelector;
