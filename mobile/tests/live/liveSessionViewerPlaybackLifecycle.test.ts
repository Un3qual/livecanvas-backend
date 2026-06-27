import { describe, expect, test } from 'bun:test';

import { handleLiveSessionViewerPlaybackChannelTerminated } from '../../src/live/liveSessionViewerPlaybackLifecycle';

describe('handleLiveSessionViewerPlaybackChannelTerminated', () => {
  test('invalidates the playback generation before pending start continuations can overwrite closed state', () => {
    let activeGeneration = 1;
    let state: 'closed' | 'connecting' | 'errored' = 'connecting';
    const calls: string[] = [];

    handleLiveSessionViewerPlaybackChannelTerminated({
      generation: 1,
      isGenerationActive: (generation) => activeGeneration === generation,
      setClosed: () => {
        calls.push('set_closed');
        state = 'closed';
      },
      stopPlaybackGeneration: (generation, options) => {
        calls.push(`stop:${generation}:${options.resetState}`);
        if (activeGeneration === generation) {
          activeGeneration += 1;
        }
      },
    });

    if (activeGeneration === 1) {
      state = 'errored';
    }

    expect(calls).toEqual(['stop:1:false', 'set_closed']);
    expect(activeGeneration).toBe(2);
    expect(state).toBe('closed');
  });

  test('ignores stale channel terminations', () => {
    const calls: string[] = [];

    handleLiveSessionViewerPlaybackChannelTerminated({
      generation: 1,
      isGenerationActive: () => false,
      setClosed: () => {
        calls.push('set_closed');
      },
      stopPlaybackGeneration: () => {
        calls.push('stop');
      },
    });

    expect(calls).toEqual([]);
  });
});
