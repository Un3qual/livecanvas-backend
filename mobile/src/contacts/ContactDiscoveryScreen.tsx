import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useRelayRouteFetchKey } from '../components/RelayRouteBoundary';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../providers/ThemeProvider';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../relay/privacySensitiveFetch';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { radius, spacing, typography } from '../theme/tokens';
import {
  appendProfileConnectionNodes,
  readProfileConnectionPageInfo,
} from '../profile/profileConnectionPagination';
import {
  CONTACT_DISCOVERY_QUERY_VARIABLES,
  contactDiscoveryQuery,
  contactDiscoveryDeliverInviteMutation,
  contactDiscoveryUpsertMutation,
  type ContactDiscoveryDeliverInviteMutation,
  type ContactDiscoveryQuery,
  type ContactDiscoveryUpsertMutation,
} from './contactDiscoveryOperations';
import {
  beginContactInviteDelivery,
  buildContactInviteInput,
  buildManualEmailContactInput,
  completeContactInviteDelivery,
  contactInviteDeliveryFailureStatus,
  createContactInviteDeliveryState,
  formatContactUpsertMutationErrors,
  normalizeContactDiscoveryEmail,
  readContactInviteDeliveryStatus,
  type ContactInviteDeliveryStatus,
  validateContactDiscoveryEmail,
} from './contactDiscoveryState';

type ContactDiscoveryData = ContactDiscoveryQuery['response'];
type ContactMatch = NonNullable<
  ReturnType<typeof readConnectionNodes<ContactMatchNode>>[number]
>;
type ContactMatchNode = NonNullable<
  NonNullable<
    NonNullable<ContactDiscoveryData['viewerContactMatches']>['edges']
  >[number]
>['node'];
type ContactMatchedUser = ContactMatch['matchedUsers'][number];
type LocalContactMatches = {
  readonly fetchKey: number;
  readonly matches: ContactMatch[];
};

const EMPTY_CONTACT_MATCH_IDS: ReadonlySet<string> = new Set();

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
  form: {
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  bodyText: typography.body,
  metadataText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  loadMorePanel: {
    gap: spacing.sm,
  },
});

export function ContactDiscoveryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const relayEnvironment = useRelayEnvironment();
  const routeFetchKey = useRelayRouteFetchKey();
  const data = useLazyLoadQuery<ContactDiscoveryQuery>(
    contactDiscoveryQuery,
    CONTACT_DISCOVERY_QUERY_VARIABLES,
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey: routeFetchKey },
  );
  const queryConnection = data.viewerContactMatches;
  const queryPageInfo = readProfileConnectionPageInfo(queryConnection);
  // Relay replaces the initial connection after the network refresh; this key
  // resets locally accumulated pages to that fresh source connection.
  const paginationResetKey = [
    queryPageInfo.endCursor ?? '',
    queryPageInfo.hasNextPage ? 'next' : 'end',
  ].join(':');
  const paginationResetKeyRef = useRef(paginationResetKey);
  const [commitUpsertContact] =
    useMutation<ContactDiscoveryUpsertMutation>(
      contactDiscoveryUpsertMutation,
    );
  const [commitDeliverInvite] =
    useMutation<ContactDiscoveryDeliverInviteMutation>(
      contactDiscoveryDeliverInviteMutation,
    );
  const activeSearchRef = useRef(false);
  const activeInviteRecipientsRef = useRef(new Set<string>());
  const inviteAttemptSequenceRef = useRef(0);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [localMatches, setLocalMatches] = useState<LocalContactMatches>({
    fetchKey: routeFetchKey,
    matches: [],
  });
  const [extraMatches, setExtraMatches] = useState<ContactMatch[]>([]);
  const [pageInfo, setPageInfo] = useState(() => queryPageInfo);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [inviteDeliveryState, setInviteDeliveryState] = useState(
    createContactInviteDeliveryState,
  );
  const queryMatches = readConnectionNodes<ContactMatch>(
    queryConnection,
  );
  const contactMatches = mergeContactMatches(
    localMatches.fetchKey === routeFetchKey ? localMatches.matches : [],
    queryMatches.concat(extraMatches),
  );
  const currentInviteRows = readCurrentInviteRows(contactMatches);
  const currentInviteRowsRef = useRef(currentInviteRows);
  currentInviteRowsRef.current = currentInviteRows;

  useEffect(() => {
    if (paginationResetKeyRef.current === paginationResetKey) {
      return;
    }

    paginationResetKeyRef.current = paginationResetKey;
    setExtraMatches([]);
    setPageInfo(queryPageInfo);
    setLoadMoreError(null);
  }, [paginationResetKey, queryPageInfo]);

  async function loadMore() {
    if (isLoadingMore || !pageInfo.hasNextPage || pageInfo.endCursor == null) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const pageData = (await fetchQuery(
        relayEnvironment,
        contactDiscoveryQuery,
        {
          ...CONTACT_DISCOVERY_QUERY_VARIABLES,
          after: pageInfo.endCursor,
        },
        PRIVACY_SENSITIVE_FETCH_OPTIONS,
      ).toPromise()) as ContactDiscoveryData | null | undefined;
      const pageConnection = pageData?.viewerContactMatches;

      setExtraMatches((current) =>
        appendProfileConnectionNodes(
          current,
          readConnectionNodes<ContactMatch>(pageConnection),
        ),
      );
      setPageInfo(readProfileConnectionPageInfo(pageConnection));
    } catch {
      setLoadMoreError('Could not load more contacts.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  function submitManualContact() {
    if (activeSearchRef.current || isSearching) {
      return;
    }

    const validationMessage = validateContactDiscoveryEmail(email);

    if (validationMessage) {
      setSearchError(validationMessage);
      return;
    }

    const input = buildManualEmailContactInput({ displayName, email });

    if (!input) {
      setSearchError('Enter a valid email address.');
      return;
    }

    activeSearchRef.current = true;
    setIsSearching(true);
    setSearchError(null);
    commitUpsertContact({
      variables: { input },
      onCompleted: (payload) => {
        activeSearchRef.current = false;
        setIsSearching(false);
        const result = payload.upsertViewerContactEntry;
        const contactMatch = result?.contactMatch;

        if (!contactMatch || result?.errors.length) {
          setSearchError(formatContactUpsertMutationErrors(result?.errors));
          return;
        }

        setLocalMatches((current) => ({
          fetchKey: routeFetchKey,
          matches: upsertLocalContactMatch(
            current.fetchKey === routeFetchKey ? current.matches : [],
            contactMatch,
          ),
        }));
      },
      onError: () => {
        activeSearchRef.current = false;
        setIsSearching(false);
        setSearchError(formatContactUpsertMutationErrors(null));
      },
    });
  }

  const deliverInvite = useCallback(
    (contactMatch: ContactMatch, recipient: string) => {
      const input = buildContactInviteInput(contactMatch.id);
      const normalizedRecipient = normalizeContactDiscoveryEmail(recipient);

      if (
        !input ||
        validateContactDiscoveryEmail(normalizedRecipient) ||
        activeInviteRecipientsRef.current.has(normalizedRecipient)
      ) {
        return;
      }

      const attemptId = ++inviteAttemptSequenceRef.current;
      const contactMatchId = contactMatch.id;
      activeInviteRecipientsRef.current.add(normalizedRecipient);
      setInviteDeliveryState((current) =>
        beginContactInviteDelivery(current, {
          attemptId,
          contactMatchId,
          recipient: normalizedRecipient,
        }),
      );

      const finish = (
        status: 'retryable_error' | 'sent' | 'terminal_invalid_recipient',
      ) => {
        activeInviteRecipientsRef.current.delete(normalizedRecipient);

        // A mutation result belongs only to the exact unmatched row that began it.
        if (
          !currentInviteRowsRef.current
            .get(normalizedRecipient)
            ?.has(contactMatchId)
        ) {
          return;
        }

        setInviteDeliveryState((current) =>
          completeContactInviteDelivery(current, {
            attemptId,
            contactMatchId,
            recipient: normalizedRecipient,
            status,
          }),
        );
      };

      commitDeliverInvite({
        variables: { input },
        onCompleted: (payload, errors) => {
          const result = payload.deliverViewerContactInvite;

          if (errors?.length || !result) {
            finish('retryable_error');
            return;
          }

          finish(
            result.errors.length === 0
              ? 'sent'
              : contactInviteDeliveryFailureStatus(result.errors),
          );
        },
        onError: () => finish('retryable_error'),
      });
    },
    [commitDeliverInvite],
  );

  const renderContactMatch = useCallback(
    ({ item: contactMatch }: ListRenderItemInfo<ContactMatch>) => (
      <View style={styles.section}>
        <ContactMatchCard
          contactMatch={contactMatch}
          inviteRecipient={contactMatch.inviteRecipient ?? null}
          inviteStatus={readContactInviteDeliveryStatus(
            inviteDeliveryState,
            contactMatch.inviteRecipient ?? '',
            currentInviteRows.get(
              normalizeContactDiscoveryEmail(
                contactMatch.inviteRecipient ?? '',
              ),
            ) ?? EMPTY_CONTACT_MATCH_IDS,
          )}
          onDeliverInvite={(recipient) =>
            deliverInvite(contactMatch, recipient)
          }
          onOpenProfile={(user) =>
            router.push({
              params: { id: user.id },
              pathname: '/profiles/[id]',
            })
          }
        />
      </View>
    ),
    [currentInviteRows, deliverInvite, inviteDeliveryState, router],
  );

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={contactMatches}
      keyExtractor={contactMatchKeyExtractor}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View style={styles.section}>
          <ScreenState
            state="empty"
            message="No contacts have been searched yet."
          />
        </View>
      }
      ListFooterComponent={
        pageInfo.hasNextPage && pageInfo.endCursor ? (
          <View style={styles.loadMorePanel}>
            <AppButton
              disabled={isLoadingMore}
              label={isLoadingMore ? 'Loading...' : 'Load more'}
              onPress={loadMore}
              variant="secondary"
            />
            {loadMoreError ? (
              <Text style={[styles.metadataText, { color: theme.colors.error }]}>
                {loadMoreError}
              </Text>
            ) : null}
          </View>
        ) : null
      }
      ListFooterComponentStyle={styles.section}
      ListHeaderComponent={
        <>
          <View style={styles.section}>
            <AppHeader
              eyebrow="Contacts"
              title="Find contacts"
              subtitle="Search one email contact at a time."
            />
          </View>
          <View style={styles.section}>
            <AppCard style={styles.form}>
              <TextInput
                accessibilityLabel="Contact email"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                  setSearchError(null);
                }}
                placeholder="friend@example.com"
                style={[
                  styles.input,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                value={email}
              />
              <TextInput
                accessibilityLabel="Display name"
                onChangeText={setDisplayName}
                placeholder="Display name"
                style={[
                  styles.input,
                  { borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                value={displayName}
              />
              <AppButton
                disabled={isSearching}
                label={isSearching ? 'Searching...' : 'Search contacts'}
                onPress={submitManualContact}
              />
              {searchError ? (
                <Text style={[styles.metadataText, { color: theme.colors.error }]}>
                  {searchError}
                </Text>
              ) : null}
            </AppCard>
          </View>
          <View style={styles.section}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Matches
            </Text>
          </View>
        </>
      }
      renderItem={renderContactMatch}
      testID="contact-discovery-list"
    />
  );
}

function contactMatchKeyExtractor(contactMatch: ContactMatch): string {
  return contactMatch.id;
}

function ContactMatchCard({
  contactMatch,
  inviteRecipient,
  inviteStatus,
  onDeliverInvite,
  onOpenProfile,
}: {
  contactMatch: ContactMatch;
  inviteRecipient: string | null;
  inviteStatus: ContactInviteDeliveryStatus;
  onDeliverInvite: (recipient: string) => void;
  onOpenProfile: (user: ContactMatchedUser) => void;
}) {
  const theme = useAppTheme();
  const hasMatches = contactMatch.matchedUsers.length > 0;
  const inviteRecipientValue = inviteRecipient?.trim() ?? '';
  const canInvite =
    !hasMatches &&
    Boolean(inviteRecipientValue) &&
    validateContactDiscoveryEmail(inviteRecipientValue) === null;

  return (
    <AppCard style={styles.row}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {contactMatch.contactName || inviteRecipient || 'Manual contact'}
      </Text>
      {hasMatches ? (
        contactMatch.matchedUsers.map((user) => (
          <View key={user.id} style={styles.row}>
            <Text style={[styles.bodyText, { color: theme.colors.text }]}>
              {user.email || 'LiveCanvas profile'}
            </Text>
            <View style={styles.actions}>
              <AppButton
                label="Open profile"
                onPress={() => onOpenProfile(user)}
                variant="secondary"
              />
            </View>
          </View>
        ))
      ) : (
        <>
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            No LiveCanvas match yet.
          </Text>
          {canInvite ? (
            <View style={styles.actions}>
              <AppButton
                disabled={
                  inviteStatus === 'sending' ||
                  inviteStatus === 'sent' ||
                  inviteStatus === 'terminal_invalid_recipient'
                }
                label={contactInviteButtonLabel(inviteStatus)}
                onPress={() => onDeliverInvite(inviteRecipientValue)}
                variant="secondary"
              />
            </View>
          ) : null}
        </>
      )}
    </AppCard>
  );
}

function contactInviteButtonLabel(status: ContactInviteDeliveryStatus): string {
  switch (status) {
    case 'idle':
      return 'Send invite';
    case 'sending':
      return 'Sending...';
    case 'sent':
      return 'Sent';
    case 'retryable_error':
      return 'Retry';
    case 'terminal_invalid_recipient':
      return 'Cannot invite';
  }
}

function readCurrentInviteRows(
  contactMatches: ReadonlyArray<ContactMatch>,
): Map<string, Set<string>> {
  const rows = new Map<string, Set<string>>();

  for (const match of contactMatches) {
    if (match.matchedUsers.length > 0 || !match.inviteRecipient) {
      continue;
    }

    const recipient = normalizeContactDiscoveryEmail(match.inviteRecipient);

    if (!validateContactDiscoveryEmail(recipient)) {
      const contactMatchIds = rows.get(recipient) ?? new Set<string>();
      contactMatchIds.add(match.id);
      rows.set(recipient, contactMatchIds);
    }
  }

  return rows;
}

function mergeContactMatches(
  localMatches: ReadonlyArray<ContactMatch>,
  queryMatches: ReadonlyArray<ContactMatch>,
): ContactMatch[] {
  const seenIds = new Set<string>();
  const matches: ContactMatch[] = [];

  for (const match of localMatches.concat(queryMatches)) {
    if (seenIds.has(match.id)) {
      continue;
    }

    seenIds.add(match.id);
    matches.push(match);
  }

  return matches;
}

function upsertLocalContactMatch(
  current: ReadonlyArray<ContactMatch>,
  incoming: ContactMatch,
): ContactMatch[] {
  return [incoming].concat(current.filter((match) => match.id !== incoming.id));
}
