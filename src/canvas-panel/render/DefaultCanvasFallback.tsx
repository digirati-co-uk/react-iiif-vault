import React from 'react';

export function DefaultCanvasFallback({ width, style, height }: { width?: number; height?: number; style?: any }) {
  return <div style={{ width, height, minHeight: 500, ...(style || {}), background: '#f9f9f9' }}>Unknown error</div>;
}
