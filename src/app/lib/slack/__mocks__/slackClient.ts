/**
 * Slack API クライアントのモック
 */

export interface MockSlackMessage {
  channel: string;
  text?: string;
  blocks?: any[];
  timestamp: string;
}

export const mockSlackMessages: MockSlackMessage[] = [];

export const mockSlackClient = {
  chat: {
    postMessage: jest.fn((params: {
      channel: string;
      text?: string;
      blocks?: any[];
    }) => {
      const message: MockSlackMessage = {
        ...params,
        timestamp: new Date().toISOString(),
      };
      mockSlackMessages.push(message);

      return Promise.resolve({
        ok: true,
        channel: params.channel,
        ts: Date.now().toString(),
        message: {
          text: params.text,
          blocks: params.blocks,
        },
      });
    }),
  },

  clearMessages: () => {
    mockSlackMessages.length = 0;
  },

  getMessages: () => [...mockSlackMessages],
};

export default mockSlackClient;
