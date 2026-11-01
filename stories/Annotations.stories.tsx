import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtlasEditorExample } from './AtlasEditorExample';
import { curved, triangle } from './EditorExample';
const meta = {
  title: 'Annotations/Edit a region',
  component: AtlasEditorExample,
  tags: ['autodocs'],
  render: (args) => <AtlasEditorExample key={JSON.stringify(args)} {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'Draw and refine one annotation. Finish shape closes drawing; Save annotation completes the request. All examples use the public Vault hooks and renderer.',
      },
    },
  },
} satisfies Meta<typeof AtlasEditorExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DrawPolygon: Story = {
  args: {
    title: 'Outline a region',
    instructions:
      'Click to add at least three vertices. Choose Finish shape, then Save annotation. Undo and redo remain available before saving.',
  },
};
export const EditVertices: Story = {
  args: {
    title: 'Refine an existing region',
    shape: triangle,
    tool: 'pointer',
    instructions:
      'Drag a vertex or edge. Click inside to select the whole shape, then resize or rotate it. Hold Shift for constrained movement.',
  },
};
export const OpenLine: Story = {
  args: {
    title: 'Trace an open line',
    tool: 'line',
    instructions: 'Place two or more points, then choose Finish line. Saving preserves the open endpoints.',
  },
};
export const Freehand: Story = {
  args: {
    title: 'Draw freely',
    tool: 'draw',
    instructions: 'Drag over the page to draw a stroke. Use Undo to try again.',
  },
};
export const Rectangle: Story = {
  args: {
    title: 'Select a rectangular region',
    tool: 'box',
    instructions: 'Drag from one corner to the other. Resize using the corners, then save.',
  },
};
export const LineBox: Story = {
  args: {
    title: 'Build a box from a line',
    tool: 'lineBox',
    instructions: 'Place a baseline, then move away from it to set the box depth and click to finish.',
  },
};
export const Stamps: Story = {
  args: {
    title: 'Place a reusable shape',
    tool: 'hexagon',
    instructions: 'Drag to place a hexagon. Try Triangle or Circle in the toolbar.',
  },
};
export const Curves: Story = {
  args: {
    title: 'Follow a curved outline',
    shape: curved,
    tool: 'pointer',
    instructions:
      'Drag the amber control handles. Select a vertex and choose Curve or Smooth. Double-click a vertex to smooth it. Saving preserves cubic controls.',
  },
};
export const SnapToAnnotations: Story = {
  args: {
    title: 'Align neighboring regions',
    options: { snap: { enabled: true, points: true, lines: true, sources: [triangle] } },
    svgOptions: { showSnapSources: true },
    instructions: 'Place a vertex near the dashed triangle. Purple guides show the resolved snap position.',
  },
};
export const Grid: Story = {
  args: {
    title: 'Place regularly spaced points',
    options: { snap: { enabled: true, grid: { spacing: 40 } } },
    instructions:
      'Place points on the page: positions snap to a 40-unit grid. Zoom in to see that grid spacing stays attached to the page.',
  },
};

export const Mobile: Story = {
  args: {
    title: 'Edit with touch or a pen',
    shape: triangle,
    tool: 'pointer',
    width: 430,
    instructions:
      'Drag vertices with one finger. Touch targets grow automatically. Use the existing Box, Draw, or Pen tools to create regions, and Hand to navigate. A second contact cancels an unfinished edit.',
  },
};
