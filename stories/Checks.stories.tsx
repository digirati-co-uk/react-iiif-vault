import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { EditorExample, triangle } from './EditorExample';
const meta = {
  title: 'Checks/Annotation commands',
  component: EditorExample,
  parameters: {
    docs: {
      description: { component: 'Automated sub-stories. The main Annotations stories remain manual and user-focused.' },
    },
  },
} satisfies Meta<typeof EditorExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SaveTriangle: Story = {
  args: { shape: triangle, tool: 'pointer', title: 'Save preserves a triangle' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save annotation' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Editing finished');
  },
};
