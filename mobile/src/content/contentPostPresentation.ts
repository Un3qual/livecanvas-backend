export type ContentPostAuthor = {
  readonly id: string;
  readonly email?: string | null;
};

export type ContentMediaAsset = {
  readonly id: string;
  readonly mimeType?: string | null;
  readonly processingState: string | null | undefined;
  readonly publicUrl?: string | null;
};

export type ContentPost = {
  readonly id: string;
  readonly kind: string | null | undefined;
  readonly bodyText?: string | null;
  readonly visibility: string | null | undefined;
  readonly expiresAt?: string | null;
  readonly insertedAt?: string | null;
  readonly author: ContentPostAuthor;
  readonly mediaAssets?: ReadonlyArray<ContentMediaAsset> | null;
};

export type ContentPostAuthorPresentation = {
  readonly title: string;
  readonly subtitle: string;
  readonly initials: string;
};

export type ContentMediaAssetPresentation = {
  readonly id: string;
  readonly kind: 'image' | 'video' | 'unknown';
  readonly label: string;
  readonly state: 'available' | 'processing' | 'failed' | 'unavailable';
  readonly publicUrl: string | null;
  readonly body: string;
};

export type ContentPostPresentation = {
  readonly id: string;
  readonly kindLabel: string;
  readonly body: string;
  readonly visibilityLabel: string;
  readonly timestampLabel: string;
  readonly storyExpiryLabel: string | null;
  readonly author: ContentPostAuthorPresentation;
  readonly mediaAssets: ReadonlyArray<ContentMediaAssetPresentation>;
};

export function formatPostCardPresentation(
  post: ContentPost,
): ContentPostPresentation {
  return {
    id: post.id,
    kindLabel: formatPostKindLabel(post.kind),
    body: formatPostBody(post.bodyText),
    visibilityLabel: formatPostVisibilityLabel(post.visibility),
    timestampLabel: formatContentDate(post.insertedAt),
    storyExpiryLabel: formatStoryExpiryLabel(post.expiresAt),
    author: formatPostAuthorPresentation(),
    mediaAssets:
      post.mediaAssets?.map((asset) =>
        formatContentMediaAssetPresentation(asset),
      ) ?? [],
  };
}

export function formatPostAuthorPresentation(): ContentPostAuthorPresentation {
  return {
    title: 'LiveCanvas creator',
    subtitle: 'Creator',
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

  const formattedDate = formatContentDate(expiresAt);

  return formattedDate === 'Date unavailable'
    ? 'Expiry unavailable'
    : `Expires ${formattedDate}`;
}

export function formatContentMediaAssetPresentation(
  asset: ContentMediaAsset,
): ContentMediaAssetPresentation {
  const kind = formatMediaAssetKind(asset.mimeType);

  if (asset.processingState === 'PROCESSED') {
    const publicUrl = normalizeContentMediaPublicUrl(asset.publicUrl);

    // A valid URL is not renderable until its media kind is recognized.
    if (publicUrl && kind !== 'unknown') {
      return {
        id: asset.id,
        kind,
        label: formatMediaAssetLabel(kind),
        state: 'available',
        publicUrl,
        body: 'Media is ready.',
      };
    }

    return unavailableMedia(asset, kind);
  }

  if (
    asset.processingState === 'PENDING_UPLOAD' ||
    asset.processingState === 'UPLOADED'
  ) {
    return {
      id: asset.id,
      kind,
      label: formatMediaAssetLabel(kind),
      state: 'processing',
      publicUrl: null,
      body: 'Media is still processing.',
    };
  }

  if (asset.processingState === 'FAILED') {
    return {
      id: asset.id,
      kind,
      label: formatMediaAssetLabel(kind),
      state: 'failed',
      publicUrl: null,
      body: 'Media could not be processed.',
    };
  }

  return unavailableMedia(asset, kind);
}

function formatPostKindLabel(kind: string | null | undefined): string {
  return kind === 'STORY' ? 'Story' : 'Post';
}

function formatPostBody(bodyText: string | null | undefined): string {
  const body = bodyText?.trim();

  return body || 'No caption provided.';
}

function formatMediaAssetKind(
  mimeType: string | null | undefined,
): ContentMediaAssetPresentation['kind'] {
  return mimeType?.startsWith('image/')
    ? 'image'
    : mimeType?.startsWith('video/')
      ? 'video'
      : 'unknown';
}

function formatMediaAssetLabel(
  kind: ContentMediaAssetPresentation['kind'],
): string {
  return kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Media';
}

function unavailableMedia(
  asset: ContentMediaAsset,
  kind: ContentMediaAssetPresentation['kind'],
): ContentMediaAssetPresentation {
  return {
    id: asset.id,
    kind,
    label: formatMediaAssetLabel(kind),
    state: 'unavailable',
    publicUrl: null,
    body: 'Media is unavailable.',
  };
}

function normalizeContentMediaPublicUrl(
  publicUrl: string | null | undefined,
): string | null {
  const trimmedPublicUrl = publicUrl?.trim();

  if (!trimmedPublicUrl) {
    return null;
  }

  const parsedUrl = parseContentMediaPublicUrl(trimmedPublicUrl);

  if (
    parsedUrl == null ||
    (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
  ) {
    return null;
  }

  return trimmedPublicUrl;
}

function parseContentMediaPublicUrl(publicUrl: string): URL | null {
  try {
    return new URL(publicUrl);
  } catch {
    return null;
  }
}

function formatContentDate(value: string | null | undefined): string {
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
