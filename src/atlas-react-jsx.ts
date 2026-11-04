import 'react';
import '@atlas-viewer/atlas';
// Atlas 3 declares its renderer elements globally. React 19 reads React.JSX.
export type AtlasIntrinsicElements = JSX.IntrinsicElements;
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends AtlasIntrinsicElements {}
  }
}

export {};
