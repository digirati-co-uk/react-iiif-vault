import React from 'react';
export declare function useContextBridge(): {
    VaultContext: {
        vault: import("@iiif/vault").Vault | null;
        setVaultInstance: (vault: import("@iiif/vault").Vault) => void;
    };
    ResourceContext: import("./ResourceContext").ResourceContextType;
    SimpleViewerReactContext: {
        setCurrentCanvasId: (newId: string | ((prev: string) => string)) => void;
        setCurrentCanvasIndex: (newId: number | ((prev: number) => number)) => void;
        currentCanvasIndex: number;
        pagingView: boolean;
        totalCanvases: number;
        nextCanvas: () => void;
        previousCanvas: () => void;
    };
    VisibleCanvasReactContext: string[];
};
export declare const ContextBridge: React.FC<{
    bridge: ReturnType<typeof useContextBridge>;
}>;
