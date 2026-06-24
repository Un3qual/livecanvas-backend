export type LiveSessionViewerPlaybackChannelTerminatedOptions = {
  readonly generation: number;
  readonly isGenerationActive: (generation: number) => boolean;
  readonly setClosed: () => void;
  readonly stopPlaybackGeneration: (
    generation: number,
    options: { readonly resetState: false },
  ) => void;
};

export function handleLiveSessionViewerPlaybackChannelTerminated({
  generation,
  isGenerationActive,
  setClosed,
  stopPlaybackGeneration,
}: LiveSessionViewerPlaybackChannelTerminatedOptions) {
  if (!isGenerationActive(generation)) {
    return;
  }

  stopPlaybackGeneration(generation, { resetState: false });
  setClosed();
}
