import { RenderingStrategy } from '../features/rendering-strategy/strategies';
export declare type StrategyActions = {
    makeChoice: (id: string, options?: {
        deselectOthers?: boolean;
        deselect?: boolean;
    }) => void;
};
export declare type UseRenderingStrategy = [RenderingStrategy, StrategyActions];
export declare type UseRenderingStrategyOptions = {
    strategies?: Array<RenderingStrategy['type']>;
    annotationPageManagerId?: string;
    defaultChoices?: string[];
};
export declare function useRenderingStrategy(options?: UseRenderingStrategyOptions): UseRenderingStrategy;
