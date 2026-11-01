import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtlasEditorExample } from './AtlasEditorExample';
import { curved } from './EditorExample';
const meta = {
  title: 'Configuration/SVG appearance',
  component: AtlasEditorExample,
  tags: ['autodocs'],
  render: (args) => <AtlasEditorExample key={JSON.stringify(args)} {...args} />,
  args: { shape: curved, tool: 'pointer', title: 'Choose an editing appearance' },
} satisfies Meta<typeof AtlasEditorExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HighContrast: Story = {
  args: {
    theme: {
      shapeStroke: '#fff',
      lineStroke: '#111',
      shapeFill: '#172b3a88',
      activeLineStroke: '#b91c1c',
      controlFill: '#fff',
      curveStroke: '#b91c1c',
      snapStroke: '#4338ca',
    },
    instructions: 'Select points and adjust curves with a stronger contrasting outline.',
  },
};
export const QuietOverlay: Story = {
  args: {
    svgOptions: { showBezierControls: false, showSnapGuides: false },
    instructions:
      'A quieter overlay hides curve controls and snap guides. The underlying editing model stays the same.',
  },
};
export const VerticesOnly: Story = {
  args: {
    svgOptions: { hideShapeLines: true, showBezierControls: false, showBoundingBox: false },
    instructions: 'Hide the selected shape outline when the host already renders the annotation underneath.',
  },
};
export const OutsideCanvas: Story = {
  args: {
    bounded: false,
    instructions:
      'Use Hand to pan, then switch back to Pointer to edit outside the original page. Removing bounds is useful for composition workflows.',
  },
};
