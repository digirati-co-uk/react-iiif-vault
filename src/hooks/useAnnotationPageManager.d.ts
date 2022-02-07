export declare function useAnnotationPageManager(resourceId?: string, options?: {
    all?: boolean;
}): {
    availablePageIds: string[];
    enabledPageIds: string[];
    setPageEnabled: (id: string, opt?: {
        deselectOthers?: boolean;
    }) => void;
    setPageDisabled: (deselectId: string) => void;
};
