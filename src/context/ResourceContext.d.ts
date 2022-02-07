import React from 'react';
export declare type ResourceContextType = {
    collection?: string;
    manifest?: string;
    range?: string;
    canvas?: string;
    annotation?: string;
};
export declare const ResourceReactContext: React.Context<ResourceContextType>;
export declare const useResourceContext: () => ResourceContextType;
export declare const ResourceProvider: React.FC<{
    value: ResourceContextType;
}>;
