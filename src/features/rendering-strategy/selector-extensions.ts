export interface SupportedSelector {
  type: string;
  temporal?: {
    startTime: number;
    endTime?: number;
  };
  spatial?: {
    unit?: 'percent' | 'pixel';
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
}

export interface BoxSelector extends SupportedSelector {
  type: 'BoxSelector';
  spatial: {
    unit?: 'percent' | 'pixel';
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PointSelector extends SupportedSelector {
  type: 'PointSelector';
  spatial: {
    x: number;
    y: number;
  };
}

export interface TemporalSelector extends SupportedSelector {
  type: 'TemporalSelector';
  temporal: {
    startTime: number;
    endTime?: number;
  };
}

export interface TemporalBoxSelector extends SupportedSelector {
  type: 'TemporalBoxSelector';
  spatial: {
    unit?: 'percent' | 'pixel';
    x: number;
    y: number;
    width: number;
    height: number;
  };
  temporal: {
    startTime: number;
    endTime?: number;
  };
}

export type SupportedSelectors = TemporalSelector | BoxSelector | TemporalBoxSelector | PointSelector;
