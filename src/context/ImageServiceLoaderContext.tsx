import React, { useContext } from 'react';
import { ImageServiceLoader } from '@atlas-viewer/iiif-image-api';

export const ImageServiceLoaderContext = React.createContext<ImageServiceLoader>(new ImageServiceLoader());

export function useImageServiceLoader() {
  return useContext(ImageServiceLoaderContext);
}
