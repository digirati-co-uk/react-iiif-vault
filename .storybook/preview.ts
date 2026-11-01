import type { Preview } from '@storybook/react-vite';
import '../stories/stories.css';
const preview: Preview = {
  parameters: {
    layout: 'padded',
    options: { storySort: { order: ['Start here', 'Read a manifest', 'Annotations', 'Configuration', 'Checks'] } },
    controls: { expanded: true },
  },
};
export default preview;
