import type { Meta, StoryObj } from '@storybook/react';
import Monitor from './Monitor';

const meta: Meta<typeof Monitor> = {
  title: 'Monitor/Monitor',
  component: Monitor,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Monitor>;

export const Default: Story = {};
