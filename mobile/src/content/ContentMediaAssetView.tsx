import { memo, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import type { ContentMediaAssetPresentation } from './contentPostPresentation';

export type ContentMediaAssetViewProps = {
  readonly asset: ContentMediaAssetPresentation;
};

export const ContentMediaAssetView = memo(function ContentMediaAssetView({
  asset,
}: ContentMediaAssetViewProps) {
  if (asset.state !== 'available' || asset.publicUrl == null) {
    return <MediaFallback body={asset.body} label={asset.label} />;
  }

  switch (asset.kind) {
    case 'image':
      return <ContentImageAsset asset={asset} publicUrl={asset.publicUrl} />;

    case 'video':
      return <ContentVideoAsset asset={asset} publicUrl={asset.publicUrl} />;

    case 'unknown':
    default:
      return <MediaFallback body="Media is unavailable." label={asset.label} />;
  }
});

function ContentImageAsset({
  asset,
  publicUrl,
}: {
  asset: ContentMediaAssetPresentation;
  publicUrl: string;
}) {
  const theme = useAppTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === publicUrl) {
    return <MediaFallback body="Image could not be loaded." label={asset.label} />;
  }

  return (
    <Image
      accessibilityLabel={`${asset.label} attachment`}
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() => setFailedUrl(publicUrl)}
      recyclingKey={asset.id}
      source={publicUrl}
      style={[
        styles.mediaSurface,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
      transition={150}
    />
  );
}

function ContentVideoAsset({
  asset,
  publicUrl,
}: {
  asset: ContentMediaAssetPresentation;
  publicUrl: string;
}) {
  const theme = useAppTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const player = useVideoPlayer(publicUrl, configureContentVideoPlayer);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        setFailedUrl(publicUrl);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, publicUrl]);

  if (failedUrl === publicUrl) {
    return <MediaFallback body="Video could not be loaded." label={asset.label} />;
  }

  return (
    <VideoView
      accessibilityLabel={`${asset.label} attachment`}
      contentFit="contain"
      nativeControls
      player={player}
      style={[
        styles.mediaSurface,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    />
  );
}

function configureContentVideoPlayer(player: VideoPlayer) {
  player.loop = false;
  player.staysActiveInBackground = false;
}

function MediaFallback({ body, label }: { body: string; label: string }) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  fallback: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  label: typography.label,
  mediaSurface: {
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
});
