import { Pressable, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { useAppTheme } from '../../providers/ThemeProvider';
import type {
  FollowRequestActionKind,
  FollowRequestState,
} from '../followRequestReducer';
import {
  formatFollowRequestPreview,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../profilePresentation';
import { EmptyCardMessage } from './ProfileCards';
import { SmallProfileAvatar } from './ProfileAvatar';
import { profileScreenStyles as styles } from './profileScreenStyles';

type ProfilePreviewUser = {
  readonly email: string | null | undefined;
  readonly id: string;
  readonly privacyMode: string;
};

type PendingFollowRequestPreview = {
  readonly follower: ProfilePreviewUser;
  readonly id: string;
  readonly requestedAt: string;
  readonly state: string;
};

export function ProfilePreviewList({
  users,
  emptyMessage,
  onOpenProfile,
}: {
  users: ReadonlyArray<ProfilePreviewUser>;
  emptyMessage: string;
  onOpenProfile: (userId: string) => void;
}) {
  if (users.length === 0) {
    return <EmptyCardMessage message={emptyMessage} />;
  }

  return (
    <View style={styles.list}>
      {users.map((user) => (
        <ProfilePreviewRow
          key={user.id}
          onOpenProfile={onOpenProfile}
          user={user}
        />
      ))}
    </View>
  );
}

function ProfilePreviewRow({
  onOpenProfile,
  user,
}: {
  onOpenProfile: (userId: string) => void;
  user: ProfilePreviewUser;
}) {
  const theme = useAppTheme();
  const identity = formatProfileIdentity(user);
  const privacy = formatPrivacyModeLabel(user.privacyMode);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpenProfile(user.id)}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.colors.border },
        pressed ? styles.pressedRow : null,
      ]}
    >
      <SmallProfileAvatar initials={identity.initials} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
          {identity.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
          {privacy.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function PendingRequestPreviewList({
  activeAction,
  errorsByRequestId,
  onAction,
  onOpenProfile,
  requests,
}: {
  activeAction: FollowRequestState['activeAction'];
  errorsByRequestId: FollowRequestState['errorsByRequestId'];
  onAction: (
    request: PendingFollowRequestPreview,
    action: FollowRequestActionKind,
  ) => void;
  onOpenProfile: (userId: string) => void;
  requests: ReadonlyArray<PendingFollowRequestPreview>;
}) {
  if (requests.length === 0) {
    return <EmptyCardMessage message="No pending follow requests." />;
  }

  return (
    <View style={styles.list}>
      {requests.map((request) => (
        <PendingRequestPreviewRow
          activeAction={activeAction}
          errorMessage={errorsByRequestId[request.id]}
          key={request.id}
          onAction={onAction}
          onOpenProfile={onOpenProfile}
          request={request}
        />
      ))}
    </View>
  );
}

function PendingRequestPreviewRow({
  activeAction,
  errorMessage,
  onAction,
  onOpenProfile,
  request,
}: {
  activeAction: FollowRequestState['activeAction'];
  errorMessage?: string;
  onAction: (
    request: PendingFollowRequestPreview,
    action: FollowRequestActionKind,
  ) => void;
  onOpenProfile: (userId: string) => void;
  request: PendingFollowRequestPreview;
}) {
  const theme = useAppTheme();
  const identity = formatProfileIdentity(request.follower);
  const requestPreview = formatFollowRequestPreview(request);
  const isActive = activeAction?.requestId === request.id;
  const isBlockedByAnotherRequest =
    activeAction != null && activeAction.requestId !== request.id;

  return (
    <View style={[styles.requestRow, { borderColor: theme.colors.border }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenProfile(request.follower.id)}
        style={({ pressed }) => [
          styles.requestIdentity,
          pressed ? styles.pressedRow : null,
        ]}
      >
        <SmallProfileAvatar initials={identity.initials} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
            {identity.title}
          </Text>
          <Text
            style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}
          >
            {requestPreview.stateLabel} - {requestPreview.requestedAtLabel}
          </Text>
          {errorMessage ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.rowActions}>
        <AppButton
          disabled={isBlockedByAnotherRequest || isActive}
          label={
            isActive && activeAction?.action === 'accept'
              ? 'Accepting...'
              : 'Accept'
          }
          onPress={() => onAction(request, 'accept')}
          style={styles.rowActionButton}
        />
        <AppButton
          disabled={isBlockedByAnotherRequest || isActive}
          label={
            isActive && activeAction?.action === 'decline'
              ? 'Declining...'
              : 'Decline'
          }
          onPress={() => onAction(request, 'decline')}
          style={styles.rowActionButton}
          variant="secondary"
        />
      </View>
    </View>
  );
}
