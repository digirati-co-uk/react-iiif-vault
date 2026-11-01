import type { StorybookConfig } from '@storybook/react-vite';
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  staticDirs: [{ from: '../stories/assets', to: '/fixtures' }],
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-docs'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // The app has multiple HTML entrypoints; Storybook owns its own iframe entry.
    config.build = { ...config.build, rollupOptions: { ...config.build?.rollupOptions, input: undefined } };
    return config;
  },
};
export default config;
