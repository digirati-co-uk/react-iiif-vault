import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtlasEditorExample } from './AtlasEditorExample';
import { iiifExamples } from './iiif-examples';
import { curved } from './EditorExample';
const meta = {
  title: 'Annotations/Live IIIF collections',
  component: AtlasEditorExample,
  tags: ['autodocs', 'live'],
  render: (args) => <AtlasEditorExample key={JSON.stringify(args)} {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'Real institutional manifests and tiled images, discovered with the IIIF skill. These network-dependent demos are separate from the deterministic checks. Example regions are illustrative, not scholarly annotations.',
      },
    },
  },
} satisfies Meta<typeof AtlasEditorExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Manuscript: Story = {
  args: {
    source: iiifExamples.forster,
    title: 'Outline a region in Leonardo’s notebook',
    instructions:
      'Use Hand to zoom into the page, then Pen to outline a region. Coordinates belong to the IIIF Canvas, which can differ from the source image dimensions.',
  },
};
export const Map: Story = {
  args: {
    source: iiifExamples.sudan,
    title: 'Trace a route on a historical map',
    tool: 'line',
    instructions:
      'Zoom into a railway with Hand, then use Line to place route points. Choose Finish line to retain the open endpoints. Save returns an SVG polyline selector.',
  },
};
export const Object: Story = {
  args: {
    source: iiifExamples.prism,
    title: 'Refine an object outline',
    tool: 'pointer',
    shape: curved,
    instructions:
      'Adjust the illustrative curved region over a surveying instrument. This manifest uses Presentation 3, Dutch labels, and an Image API 3 service.',
  },
};
