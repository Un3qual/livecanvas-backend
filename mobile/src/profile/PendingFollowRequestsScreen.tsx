import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing, typography } from '../theme/tokens';
import {
  PROFILE_CONNECTION_QUERY_VARIABLES,
  acceptFollowRequestMutation,
  declineFollowRequestMutation,
  pendingRequestsQuery,
  type PendingRequestsQuery,
  type ProfileConnectionAcceptFollowRequestMutation,
  type ProfileConnectionDeclineFollowRequestMutation,
} from './profileConnectionOperations';

type PendingFollowRequest = NonNullable<
  ReturnType<typeof readConnectionNodes<PendingFollowRequestNode>>[number]
>;
type PendingFollowRequestNode = NonNullable<
  NonNullable<
    NonNullable<PendingRequestsQuery['response']['viewerPendingFollowRequests']>['edges']
  >[number]
>['node'];
type PendingAction =
  | {
      readonly action: 'accept' | 'decline';
      readonly requestId: string;
    }
  | null;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  identityButton: {
    borderWidth: 1,
    padding: spacing.md,
  },
  title: typography.label,
  bodyText: typography.body,
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

export function PendingFollowRequestsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<PendingRequestsQuery>(
    pendingRequestsQuery,
    PROFILE_CONNECTION_QUERY_VARIABLES,
    { fetchPolicy: 'store-and-network' },
  );
  const [commitAcceptFollowRequest] =
    useMutation<ProfileConnectionAcceptFollowRequestMutation>(
      acceptFollowRequestMutation,
    );
  const [commitDeclineFollowRequest] =
    useMutation<ProfileConnectionDeclineFollowRequestMutation>(
      declineFollowRequestMutation,
    );
  const [requests, setRequests] = useState<PendingFollowRequest[]>(() =>
    readConnectionNodes<PendingFollowRequest>(
      data.viewerPendingFollowRequests,
    ),
  );
  const activeActionRef = useRef<PendingAction>(null);
  const [activeAction, setActiveAction] = useState<PendingAction>(null);
  const [errorsByRequestId, setErrorsByRequestId] = useState<
    Readonly<Record<string, string>>
  >({});

  function submitRequestAction(
    request: PendingFollowRequest,
    action: 'accept' | 'decline',
  ) {
    if (activeActionRef.current !== null || activeAction !== null) {
      return;
    }

    const nextAction = { action, requestId: request.id } as const;
    activeActionRef.current = nextAction;
    setActiveAction(nextAction);
    setErrorsByRequestId((current) => omitRequestError(current, request.id));

    const variables = { input: { followerId: request.follower.id } };
    const handleError = () => {
      activeActionRef.current = null;
      setActiveAction(null);
      setErrorsByRequestId((current) => ({
        ...current,
        [request.id]: 'We could not update this follow request.',
      }));
    };
    const handleSuccess = () => {
      activeActionRef.current = null;
      setActiveAction(null);
      setRequests((current) =>
        current.filter((currentRequest) => currentRequest.id !== request.id),
      );
    };

    if (action === 'accept') {
      commitAcceptFollowRequest({
        variables,
        onCompleted: (payload) => {
          const result = payload.acceptFollowRequest;

          if (!result?.follow || result.errors.length > 0) {
            handleError();
            return;
          }

          handleSuccess();
        },
        onError: handleError,
      });
      return;
    }

    commitDeclineFollowRequest({
      variables,
      onCompleted: (payload) => {
        const result = payload.declineFollowRequest;

        if (!result || result.errors.length > 0) {
          handleError();
          return;
        }

        handleSuccess();
      },
      onError: handleError,
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Profile"
        title="Follow requests"
        subtitle="Review incoming follow requests."
      />

      <View style={styles.section}>
        {requests.length > 0 ? (
          requests.map((request) => (
            <PendingRequestRow
              activeAction={activeAction}
              errorMessage={errorsByRequestId[request.id] ?? null}
              key={request.id}
              onAction={submitRequestAction}
              onOpenProfile={(userId) =>
                router.push({
                  params: { id: userId },
                  pathname: '/profiles/[id]',
                })
              }
              request={request}
            />
          ))
        ) : (
          <ScreenState state="empty" message="No pending follow requests." />
        )}
      </View>
    </ScrollView>
  );
}

function PendingRequestRow({
  activeAction,
  errorMessage,
  onAction,
  onOpenProfile,
  request,
}: {
  activeAction: PendingAction;
  errorMessage: string | null;
  onAction: (
    request: PendingFollowRequest,
    action: 'accept' | 'decline',
  ) => void;
  onOpenProfile: (userId: string) => void;
  request: PendingFollowRequest;
}) {
  const theme = useAppTheme();
  const label = request.follower.email || 'LiveCanvas profile';
  const isActive = activeAction?.requestId === request.id;
  const isBlocked = activeAction !== null && activeAction.requestId !== request.id;

  return (
    <AppCard style={styles.row}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => onOpenProfile(request.follower.id)}
        style={({ pressed }) => [
          styles.identityButton,
          { borderColor: theme.colors.border, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          Pending
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <AppButton
          disabled={isBlocked || isActive}
          label={
            isActive && activeAction?.action === 'accept'
              ? 'Accepting...'
              : 'Accept'
          }
          onPress={() => onAction(request, 'accept')}
        />
        <AppButton
          disabled={isBlocked || isActive}
          label={
            isActive && activeAction?.action === 'decline'
              ? 'Declining...'
              : 'Decline'
          }
          onPress={() => onAction(request, 'decline')}
          variant="secondary"
        />
      </View>
      {errorMessage ? (
        <Text style={[styles.bodyText, { color: theme.colors.error }]}>
          {errorMessage}
        </Text>
      ) : null}
    </AppCard>
  );
}

function omitRequestError(
  values: Readonly<Record<string, string>>,
  requestId: string,
): Readonly<Record<string, string>> {
  if (!Object.hasOwn(values, requestId)) {
    return values;
  }

  const { [requestId]: _removed, ...rest } = values;
  return rest;
}
