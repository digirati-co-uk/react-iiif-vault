import React from 'react';
import type { FallbackProps } from 'react-error-boundary';

export function DefaultCanvasFallback({
  width,
  style,
  height,
  error,
  resetErrorBoundary,
}: { width?: number; height?: number; style?: any } & FallbackProps) {
  return (
    <div style={{ width, height, minHeight: 500, ...(style || {}), background: '#f9f9f9' }}>
      <h3>Error occurred</h3>
      <p>{error.message}</p>
      <button type="button" onClick={resetErrorBoundary}>
        Reset
      </button>
    </div>
  );
}
