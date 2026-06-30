export type FeedPostAuthorInput = {
  readonly id: string;
  readonly email?: string | null;
};

export type FeedMediaAssetInput = {
  readonly id: string;
  readonly mimeType?: string | null;
  readonly processingState: string | null | undefined;
  readonly publicUrl?: string | null;
};

export type FeedPostCardInput = {
  readonly id: string;
  readonly kind: string | null | undefined;
  readonly bodyText?: string | null;
  readonly visibility: string | null | undefined;
  readonly expiresAt?: string | null;
  readonly insertedAt?: string | null;
  readonly author: FeedPostAuthorInput;
  readonly mediaAssets?: ReadonlyArray<FeedMediaAssetInput> | null;
};

export type FeedPostAuthorPresentation = {
  readonly title: string;
  readonly subtitle: string;
  readonly initials: string;
};

export type FeedMediaAssetPresentation = {
  readonly id: string;
  readonly label: string;
  readonly state: 'available' | 'processing' | 'failed' | 'unavailable';
  readonly publicUrl: string | null;
  readonly body: string;
};

export type FeedPostCardPresentation = {
  readonly id: string;
  readonly kindLabel: string;
  readonly body: string;
  readonly visibilityLabel: string;
  readonly timestampLabel: string;
  readonly storyExpiryLabel: string | null;
  readonly author: FeedPostAuthorPresentation;
  readonly mediaAssets: ReadonlyArray<FeedMediaAssetPresentation>;
};

export function formatPostCardPresentation(
  post: FeedPostCardInput,
): FeedPostCardPresentation {
  return {
    id: post.id,
    kindLabel: formatPostKindLabel(post.kind),
    body: formatPostBody(post.bodyText),
    visibilityLabel: formatPostVisibilityLabel(post.visibility),
    timestampLabel: formatFeedDate(post.insertedAt),
    storyExpiryLabel: formatStoryExpiryLabel(post.expiresAt),
    author: formatPostAuthorPresentation(post.author),
    mediaAssets:
      post.mediaAssets?.map((asset) =>
        formatFeedMediaAssetPresentation(asset),
      ) ?? [],
  };
}

export function formatPostAuthorPresentation(
  author: FeedPostAuthorInput,
): FeedPostAuthorPresentation {
  const email = author.email?.trim();

  if (email) {
    return {
      title: email,
      subtitle: 'Creator',
      initials: email.charAt(0).toUpperCase(),
    };
  }

  return {
    title: 'LiveCanvas creator',
    subtitle: `Profile ID ${author.id.slice(0, 8)}`,
    initials: 'LC',
  };
}

export function formatPostVisibilityLabel(
  visibility: string | null | undefined,
): string {
  switch (visibility) {
    case 'PUBLIC':
      return 'Public';

    case 'FOLLOWERS':
      return 'Followers';

    default:
      return 'Visibility unavailable';
  }
}

export function formatStoryExpiryLabel(
  expiresAt: string | null | undefined,
): string | null {
  if (expiresAt == null) {
    return null;
  }

  const formattedDate = formatFeedDate(expiresAt);

  return formattedDate === 'Date unavailable'
    ? 'Expiry unavailable'
    : `Expires ${formattedDate}`;
}

export function formatFeedMediaAssetPresentation(
  asset: FeedMediaAssetInput,
): FeedMediaAssetPresentation {
  if (asset.processingState === 'PROCESSED') {
    const publicUrl = normalizeFeedMediaPublicUrl(asset.publicUrl);

    if (publicUrl) {
      return {
        id: asset.id,
        label: formatMediaAssetLabel(asset.mimeType),
        state: 'available',
        publicUrl,
        body: 'Media is ready.',
      };
    }

    return unavailableMedia(asset);
  }

  if (
    asset.processingState === 'PENDING_UPLOAD' ||
    asset.processingState === 'UPLOADED'
  ) {
    return {
      id: asset.id,
      label: formatMediaAssetLabel(asset.mimeType),
      state: 'processing',
      publicUrl: null,
      body: 'Media is still processing.',
    };
  }

  if (asset.processingState === 'FAILED') {
    return {
      id: asset.id,
      label: formatMediaAssetLabel(asset.mimeType),
      state: 'failed',
      publicUrl: null,
      body: 'Media could not be processed.',
    };
  }

  return unavailableMedia(asset);
}

function formatPostKindLabel(kind: string | null | undefined): string {
  return kind === 'STORY' ? 'Story' : 'Post';
}

function formatPostBody(bodyText: string | null | undefined): string {
  const body = bodyText?.trim();

  return body || 'No caption provided.';
}

function formatMediaAssetLabel(mimeType: string | null | undefined): string {
  if (mimeType?.startsWith('image/')) {
    return 'Image';
  }

  if (mimeType?.startsWith('video/')) {
    return 'Video';
  }

  return 'Media';
}

function unavailableMedia(
  asset: FeedMediaAssetInput,
): FeedMediaAssetPresentation {
  return {
    id: asset.id,
    label: formatMediaAssetLabel(asset.mimeType),
    state: 'unavailable',
    publicUrl: null,
    body: 'Media is unavailable.',
  };
}

function normalizeFeedMediaPublicUrl(
  publicUrl: string | null | undefined,
): string | null {
  const trimmedPublicUrl = publicUrl?.trim();

  if (!trimmedPublicUrl) {
    return null;
  }

  try {
    new URL(trimmedPublicUrl);
    return trimmedPublicUrl;
  } catch {
    return null;
  }
}

function formatFeedDate(value: string | null | undefined): string {
  if (value == null) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}
