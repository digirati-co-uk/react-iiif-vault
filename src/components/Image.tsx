import { ImageService, ImageSize } from '@iiif/presentation-3';
import { useEffect, useState } from 'react';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { useImage } from '../hooks/useImage';
import { RegionParameter, RotationParameter } from '@iiif/parser/image-3';

export interface ImageProps {
  src: string | ImageService;
  alt?: string;
  size?: Partial<ImageSize>;
  region?: RegionParameter;
  className?: string;
  style?: React.CSSProperties;
  fetchImageService?: boolean;
  quality?: string;
  rotation?: number | RotationParameter;
  format?: string;

  // Later -> make it responsive.
  // responsive?: boolean;
  // sizes?: ImageSize[];
}

function RemoteImage(props: ImageProps) {
  const serviceId = typeof props.src === 'string' ? props.src : props.src.id;
  const imageService = useImageServiceLoader();
  const [isLoaded, setIsLoaded] = useState(false);

  let service: ImageService | undefined = undefined;

  if (serviceId) {
    const foundService = imageService.loadServiceSync({ id: serviceId } as any);
    if (foundService) {
      service = foundService as ImageService;
    }
  }

  if (!service && !isLoaded) {
    imageService.loadService({ id: serviceId } as any).then(() => {
      setIsLoaded(true);
    });
  }

  const src = useImage(
    service,
    {
      size: props.size,
      selector: props.region,
      rotation: props.rotation,
      format: props.format,
      region: props.region,
      quality: props.quality,
    },
    [isLoaded, props.src, props.size, props.region, props.rotation, props.format, props.region, props.quality]
  );

  useEffect(() => {
    return () => {
      setIsLoaded(false);
    };
  }, [serviceId]);

  if (!src) {
    return <Image {...props} fetchImageService={false} />;
  }

  return <img src={src} alt={props.alt} className={props.className} style={props.style} />;
}

export function Image(props: ImageProps) {
  if (props.fetchImageService) {
    return <RemoteImage {...props} />;
  }

  const service = typeof props.src === 'string' ? { id: props.src, profile: 'level0' as const } : props.src;
  const src = useImage(
    service,
    {
      size: props.size,
      selector: props.region,
      rotation: props.rotation,
      format: props.format,
      region: props.region,
      quality: props.quality,
    },
    [props.src, props.size, props.region, props.rotation, props.format, props.region, props.quality]
  );

  if (!src) {
    return null;
  }

  return <img src={src} alt={props.alt} className={props.className} style={props.style} />;
}
