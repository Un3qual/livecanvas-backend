import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { radius, spacing, typography } from '../theme/tokens';
import {
  CONTACT_DISCOVERY_QUERY_VARIABLES,
  contactDiscoveryDeliverInviteMutation,
  contactDiscoveryQuery,
  contactDiscoveryUpsertMutation,
  type ContactDiscoveryDeliverInviteMutation,
  type ContactDiscoveryQuery,
  type ContactDiscoveryUpsertMutation,
} from './contactDiscoveryOperations';
import {
  buildContactInviteInput,
  buildManualEmailContactInput,
  contactDiscoveryInviteSentMessage,
  formatContactInviteMutationErrors,
  formatContactUpsertMutationErrors,
  normalizeContactDiscoveryEmail,
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
});

export function ContactDiscoveryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<ContactDiscoveryQuery>(
    contactDiscoveryQuery,
    CONTACT_DISCOVERY_QUERY_VARIABLES,
    { fetchPolicy: 'store-and-network' },
  );
  const [commitUpsertContact] =
    useMutation<ContactDiscoveryUpsertMutation>(
      contactDiscoveryUpsertMutation,
    );
  const [commitDeliverInvite] =
    useMutation<ContactDiscoveryDeliverInviteMutation>(
      contactDiscoveryDeliverInviteMutation,
    );
  const activeSearchRef = useRef(false);
  const activeInviteContactIdRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [localMatches, setLocalMatches] = useState<ContactMatch[]>([]);
  const [inviteRecipientsByContactId, setInviteRecipientsByContactId] =
    useState<Readonly<Record<string, string>>>({});
  const [activeInviteContactId, setActiveInviteContactId] =
    useState<string | null>(null);
  const [inviteErrorsByContactId, setInviteErrorsByContactId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [inviteMessagesByContactId, setInviteMessagesByContactId] = useState<
    Readonly<Record<string, string>>
  >({});
  const queryMatches = readConnectionNodes<ContactMatch>(
    data.viewerContactMatches,
  );
  const contactMatches = mergeContactMatches(localMatches, queryMatches);

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

        setLocalMatches((current) => upsertLocalContactMatch(current, contactMatch));

        if (contactMatch.matchedUsers.length === 0) {
          const normalizedEmail = normalizeContactDiscoveryEmail(email);

          setInviteRecipientsByContactId((current) => ({
            ...current,
            [contactMatch.id]: normalizedEmail,
          }));
        }
      },
      onError: () => {
        activeSearchRef.current = false;
        setIsSearching(false);
        setSearchError(formatContactUpsertMutationErrors(null));
      },
    });
  }

  function inviteContact(contactMatch: ContactMatch) {
    const recipient = inviteRecipientsByContactId[contactMatch.id];

    if (
      !recipient ||
      activeInviteContactIdRef.current !== null ||
      activeInviteContactId !== null
    ) {
      return;
    }

    const input = buildContactInviteInput(recipient);

    if (!input) {
      setInviteErrorsByContactId((current) => ({
        ...current,
        [contactMatch.id]: 'Enter a valid email address.',
      }));
      return;
    }

    activeInviteContactIdRef.current = contactMatch.id;
    setActiveInviteContactId(contactMatch.id);
    setInviteErrorsByContactId((current) =>
      omitContactMessage(current, contactMatch.id),
    );
    setInviteMessagesByContactId((current) =>
      omitContactMessage(current, contactMatch.id),
    );

    commitDeliverInvite({
      variables: { input },
      onCompleted: (payload) => {
        activeInviteContactIdRef.current = null;
        setActiveInviteContactId(null);
        const result = payload.deliverViewerContactInvite;

        if (!result || result.errors.length > 0) {
          setInviteErrorsByContactId((current) => ({
            ...current,
            [contactMatch.id]: formatContactInviteMutationErrors(result?.errors),
          }));
          return;
        }

        setInviteMessagesByContactId((current) => ({
          ...current,
          [contactMatch.id]: contactDiscoveryInviteSentMessage(recipient),
        }));
      },
      onError: () => {
        activeInviteContactIdRef.current = null;
        setActiveInviteContactId(null);
        setInviteErrorsByContactId((current) => ({
          ...current,
          [contactMatch.id]: formatContactInviteMutationErrors(null),
        }));
      },
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Contacts"
        title="Find contacts"
        subtitle="Search one email contact at a time."
      />

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

      <View style={styles.section}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Matches
        </Text>
        {contactMatches.length > 0 ? (
          contactMatches.map((contactMatch) => (
            <ContactMatchCard
              activeInviteContactId={activeInviteContactId}
              contactMatch={contactMatch}
              inviteError={inviteErrorsByContactId[contactMatch.id] ?? null}
              inviteMessage={inviteMessagesByContactId[contactMatch.id] ?? null}
              inviteRecipient={
                inviteRecipientsByContactId[contactMatch.id] ?? null
              }
              key={contactMatch.id}
              onInvite={inviteContact}
              onOpenProfile={(user) =>
                router.push({
                  params: { id: user.id },
                  pathname: '/profiles/[id]',
                })
              }
            />
          ))
        ) : (
          <ScreenState
            state="empty"
            message="No contacts have been searched yet."
          />
        )}
      </View>
    </ScrollView>
  );
}

function ContactMatchCard({
  activeInviteContactId,
  contactMatch,
  inviteError,
  inviteMessage,
  inviteRecipient,
  onInvite,
  onOpenProfile,
}: {
  activeInviteContactId: string | null;
  contactMatch: ContactMatch;
  inviteError: string | null;
  inviteMessage: string | null;
  inviteRecipient: string | null;
  onInvite: (contactMatch: ContactMatch) => void;
  onOpenProfile: (user: ContactMatchedUser) => void;
}) {
  const theme = useAppTheme();
  const hasMatches = contactMatch.matchedUsers.length > 0;
  const isInviting = activeInviteContactId === contactMatch.id;

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
          {inviteRecipient ? (
            <View style={styles.actions}>
              <AppButton
                disabled={isInviting}
                label={isInviting ? 'Sending...' : 'Send invite'}
                onPress={() => onInvite(contactMatch)}
                variant="secondary"
              />
            </View>
          ) : null}
        </>
      )}
      {inviteMessage ? (
        <Text style={[styles.metadataText, { color: theme.colors.text }]}>
          {inviteMessage}
        </Text>
      ) : null}
      {inviteError ? (
        <Text style={[styles.metadataText, { color: theme.colors.error }]}>
          {inviteError}
        </Text>
      ) : null}
    </AppCard>
  );
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

function omitContactMessage(
  values: Readonly<Record<string, string>>,
  contactId: string,
): Readonly<Record<string, string>> {
  if (!Object.hasOwn(values, contactId)) {
    return values;
  }

  const { [contactId]: _removed, ...rest } = values;
  return rest;
}
