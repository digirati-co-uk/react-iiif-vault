import { Reference } from '@iiif/presentation-3';
declare type SupportedEvents = 'onClick';
export declare function useEventListener<T>(resource: Reference, name: SupportedEvents, listener: (e: any, resource: T) => void, scope?: string[], deps?: any[]): void;
export {};
