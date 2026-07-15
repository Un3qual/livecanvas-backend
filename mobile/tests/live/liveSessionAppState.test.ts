import { describe, expect, test } from 'vitest';

import {
  createLiveSessionAppState,
  reduceLiveSessionAppState,
} from '../../src/live/watch/liveSessionAppState';

describe('liveSessionAppState', () => {
  test('tracks active state without treating duplicate notifications as resumes', () => {
    const initial = createLiveSessionAppState('active');

    expect(initial).toEqual({ isActive: true, resumeGeneration: 0 });
    expect(reduceLiveSessionAppState(initial, 'active')).toBe(initial);

    const backgrounded = reduceLiveSessionAppState(initial, 'background');
    expect(backgrounded).toEqual({ isActive: false, resumeGeneration: 0 });
    expect(reduceLiveSessionAppState(backgrounded, 'inactive')).toBe(
      backgrounded,
    );

    const resumed = reduceLiveSessionAppState(backgrounded, 'active');
    expect(resumed).toEqual({ isActive: true, resumeGeneration: 1 });
    expect(reduceLiveSessionAppState(resumed, 'active')).toBe(resumed);
  });

  test('increments once for every completed background-to-active cycle', () => {
    const firstBackground = reduceLiveSessionAppState(
      createLiveSessionAppState('active'),
      'background',
    );
    const firstResume = reduceLiveSessionAppState(firstBackground, 'active');
    const secondBackground = reduceLiveSessionAppState(
      firstResume,
      'inactive',
    );
    const secondResume = reduceLiveSessionAppState(
      secondBackground,
      'active',
    );

    expect(secondResume).toEqual({ isActive: true, resumeGeneration: 2 });
  });
});
