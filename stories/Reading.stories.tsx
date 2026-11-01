import type { Meta, StoryObj } from '@storybook/react-vite';
import { ViewerExample } from './ViewerExample';
const meta = {
  title: 'Read a manifest/Viewer',
  component: ViewerExample,
  tags: ['autodocs'],
  render: (args) => <ViewerExample key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof ViewerExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SinglePage: Story = {};
export const FacingPages: Story = { args: { paging: true } };
export const RightToLeft: Story = { args: { paging: true, direction: 'right-to-left' } };
export const RotatedPage: Story = { args: { rotation: 90 } };
export const Metadata: Story = { args: { metadata: true } };
export const AnnotationLayers: Story = { args: { annotations: true } };
export const DrawInViewer: Story = { args: { editing: true } };
export const DrawInFacingPages: Story = { args: { editing: true, paging: true } };
export const TextualCanvas: Story = { args: { kind: 'text' } };
export const AudioCanvas: Story = { args: { kind: 'audio' } };
