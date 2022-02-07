import { Reference } from '@iiif/presentation-3';
export declare function useStyles<Style extends Record<string, Record<string, any>>>(resource: undefined | Reference<any>): Style;
export declare function useStyles<Style extends Record<string, any>>(resource: undefined | Reference<any>, scope: string): Style;
