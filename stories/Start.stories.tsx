import type { Meta, StoryObj } from '@storybook/react-vite';
const meta: Meta = { title: 'Start here/Guide' };
export default meta;
export const Welcome: StoryObj = {
  render: () => (
    <article className="vault-story">
      <h1>Explore React IIIF Vault</h1>
      <p>
        Open a manifest, browse its pages, and create annotations. Each example explains a task and leaves the controls
        in your hands.
      </p>
      <ol>
        <li>
          <strong>Read a manifest</strong> — images, page navigation, metadata, text, media, and annotation layers.
        </li>
        <li>
          <strong>Annotations</strong> — polygons, boxes, freehand, curves, snapping, and automatic touch input.
        </li>
        <li>
          <strong>Configuration</strong> — SVG themes and optional editing feedback.
        </li>
        <li>
          <strong>Checks</strong> — small automated scenarios for behavior we add from here.
        </li>
      </ol>
      <p>
        Most examples use local fixtures and work offline. Examples marked Live load an external IIIF service. Use the
        Controls panel to change the exposed configuration.
      </p>
      <p>Finish shape ends drawing. Save annotation completes the request. Undo and redo apply while editing.</p>
    </article>
  ),
};
