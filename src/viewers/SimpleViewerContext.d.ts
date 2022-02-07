import React from 'react';
import { FC } from 'react';
declare type SimpleViewerContext = {
    setCurrentCanvasId: (newId: string | ((prev: string) => string)) => void;
    setCurrentCanvasIndex: (newId: number | ((prev: number) => number)) => void;
    currentCanvasIndex: number;
    pagingView: boolean;
    totalCanvases: number;
    nextCanvas: () => void;
    previousCanvas: () => void;
};
export declare const SimpleViewerReactContext: React.Context<SimpleViewerContext>;
export declare const SimpleViewerProvider: FC<{
    manifest: string;
}>;
export declare function useSimpleViewer(): SimpleViewerContext;
export {};
