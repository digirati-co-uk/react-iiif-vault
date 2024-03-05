import React, { ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
/**
 * Simple viewer context
 * *****************************************************************************
 *
 * This will be the context to use to get a basic IIIF viewer up and running.
 * It will not focus on having compatibility with the full range of IIIF
 * resources, instead offering a viewer for a Manifest, cycling through canvases
 * while ignoring the paged/facing-pages/continuous behaviors.
 *
 * There will not be support for canvas-on-canvas annotations. Annotations will
 * be filtered, giving details of the canvas space and images to be annotated
 * onto that space. The demo implementation of this viewer will use
 * OpenSeadragon to display.
 *
 * Navigation functions will include the basics:
 * - nextCanvas()
 * - previousCanvas()
 * - goToCanvas(id)
 * - goToCanvasIndex(idx)
 * - goToFirstCanvas()
 * - goToLastCanvas()
 *
 * It will take in only a Manifest ID and will load that Manifest when the
 * context loads.
 *
 * There will be no support for external or embedded annotation lists, although
 * you can set up a nested context to support this.
 *
 * There will be no support for ranges in this view.
 *
 * To use this component, first you will need the provider:
 * import { SimpleViewerProvider } from '...';
 *
 * <SimpleViewerProvider id="http://example.org/manifest.json">
 *   <CustomComponent />
 * </SimpleViewerProvider>
 *
 * This is in addition to the core Vault context further up the tree.
 *
 * In components that you want to use parts of the state you can grab the hooks
 * from this file.
 *
 * import { useSimpleViewer } from '...';
 *
 * And use them in your components to get the actions.
 *
 * function NextButton() {
 *   const { nextCanvas } = useSimpleViewer();
 *
 *   return <button onClick={nextCanvas}>Next</button>;
 * }
 *
 * Since this is a single-context, there is only ever one manifest, canvas and
 * annotation list. You can access the current resource using the normal hooks.
 *
 * function CanvasMetadata() {
 *   const metadata = useCanvas(metadataSelector);
 *
 *   return <div> ... </div>
 * }
 *
 * So long as this is inside the provider, it will have the correct context.
 */
import { createContext, FC, useMemo, useState } from 'react';
import { useExternalManifest } from '../hooks/useExternalManifest';
import { ManifestContext } from '../context/ManifestContext';
import { CanvasContext } from '../context/CanvasContext';
import { VisibleCanvasReactContext } from '../context/VisibleCanvasContext';
import { useManifest } from '../hooks/useManifest';
import { SimpleViewerContext, SimpleViewerProps } from './SimpleViewerContext.types';
import { RangeContext } from '../context/RangeContext';
import { useCanvasSequence } from './SimpleViewerContext.hooks';
import { VaultProvider } from '../context/VaultContext';
import { useExistingVault } from '../hooks/useExistingVault';

const noop = () => {
  //
};

export const SimpleViewerReactContext = createContext<SimpleViewerContext>({
  setCurrentCanvasId: noop,
  setCurrentCanvasIndex: noop,
  nextCanvas: noop,
  previousCanvas: noop,
  items: [],
  sequence: [],
  setSequenceIndex: noop,
  currentSequenceIndex: 0,
  hasNext: false,
  hasPrevious: false,
});

export function InnerViewerProvider(props: SimpleViewerProps) {
  const manifest = useManifest();
  const {
    cursor,
    visibleItems,
    next,
    sequence,
    items,
    setCanvasIndex,
    setCanvasId,
    previous,
    setSequenceIndex,
    hasNext,
    hasPrevious,
  } = useCanvasSequence({
    startCanvas: props.startCanvas,
    disablePaging: props.pagingEnabled === false,
  });

  const ctx = useMemo(
    () =>
      ({
        sequence,
        items,
        // Extra functions.
        setCurrentCanvasId: setCanvasId,
        nextCanvas: next,
        previousCanvas: previous,
        totalCanvases: items.length,
        setCurrentCanvasIndex: setCanvasIndex,
        setSequenceIndex: setSequenceIndex,
        currentSequenceIndex: cursor,
        hasNext,
        hasPrevious,
      } as SimpleViewerContext),
    [sequence, items, setCanvasId, next, previous, items, setCanvasIndex, setSequenceIndex, cursor]
  );

  if (!manifest) {
    console.warn('The manifest passed to the provider is not a valid IIIF manifest.');
    return <div>Sorry, something went wrong.</div>;
  }

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <SimpleViewerReactContext.Provider value={ctx}>
      <VisibleCanvasReactContext.Provider value={visibleItems}>
        <CanvasContext canvas={visibleItems[0]}>{props.children}</CanvasContext>
      </VisibleCanvasReactContext.Provider>
    </SimpleViewerReactContext.Provider>
  );
}

export function SimpleViewerProvider(props: SimpleViewerProps) {
  const vault = useExistingVault(props.vault);
  const manifest = useExternalManifest(props.manifest);

  if (!manifest) {
    console.warn('The manifest passed to the provider is not a valid IIIF manifest.');
    return <div>Sorry, something went wrong.</div>;
  }

  if (manifest.error) {
    return <div>{manifest.error.toString()}</div>;
  }

  if (!manifest.isLoaded) {
    return <div>Loading...</div>;
  }

  const inner = <InnerViewerProvider {...props}>{props.children}</InnerViewerProvider>;

  return (
    <VaultProvider vault={vault}>
      <ManifestContext manifest={manifest.id}>
        {props.rangeId ? <RangeContext range={props.rangeId}>{inner}</RangeContext> : inner}
      </ManifestContext>
    </VaultProvider>
  );
}

export function useSimpleViewer() {
  return useContext(SimpleViewerReactContext);
}
