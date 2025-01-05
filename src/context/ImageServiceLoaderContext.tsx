import React, { useContext } from 'react';
import { ImageServiceLoader } from '@iiif/helpers/image-service';

export const ImageServiceLoaderContext = React.createContext<ImageServiceLoader>(new ImageServiceLoader());

export function useImageServiceLoader() {
  return useContext(ImageServiceLoaderContext);
}
