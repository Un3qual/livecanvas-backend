import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLazyLoadQuery, useMutation } from 'react-relay';

import type { accountSettingsOperationsCancelAccountDeletionMutation } from '../__generated__/accountSettingsOperationsCancelAccountDeletionMutation.graphql';
import type { accountSettingsOperationsQuery } from '../__generated__/accountSettingsOperationsQuery.graphql';
import type { accountSettingsOperationsRequestAccountDeletionMutation } from '../__generated__/accountSettingsOperationsRequestAccountDeletionMutation.graphql';
import type { accountSettingsOperationsRequestDataExportMutation } from '../__generated__/accountSettingsOperationsRequestDataExportMutation.graphql';
import type { accountSettingsOperationsUnlinkIdentityMutation } from '../__generated__/accountSettingsOperationsUnlinkIdentityMutation.graphql';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useRelayRouteFetchKey } from '../components/RelayRouteBoundary';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { profileScreenStyles as styles } from '../profile/components/profileScreenStyles';
import {
  accountDeletionStatusLabel,
  canCancelAccountDeletionRequest,
  dataExportStatusLabel,
  formatAccountSettingsMutationErrors,
  identityProviderLabel,
  type AccountDeletionStatus,
  type DataExportStatus,
} from './accountSettingsState';
import {
  accountSettingsCancelAccountDeletionMutation,
  accountSettingsQuery,
  accountSettingsRequestAccountDeletionMutation,
  accountSettingsRequestDataExportMutation,
  accountSettingsUnlinkIdentityMutation,
} from './accountSettingsOperations';

type AccountSettingsAction =
  | 'request-data-export'
  | 'request-account-deletion'
  | `cancel-deletion:${string}`
  | `unlink-identity:${string}`;

type AccountSettingsIdentity = {
  readonly authProvider?: string | null;
  readonly canUnlink: boolean;
  readonly id: string;
  readonly insertedAt: string;
  readonly provider: string;
};

type DataExportRequest = {
  readonly completedAt?: string | null;
  readonly failureReason?: string | null;
  readonly format: string;
  readonly id: string;
  readonly requestedAt: string;
  readonly status: DataExportStatus;
};

type AccountDeletionRequest = {
  readonly completedAt?: string | null;
  readonly failureReason?: string | null;
  readonly id: string;
  readonly requestedAt: string;
  readonly scheduledPurgeAt: string;
  readonly status: AccountDeletionStatus;
};

type ErrorOnlyResult = {
  readonly errors: Parameters<typeof formatAccountSettingsMutationErrors>[0];
} | null | undefined;

export function AccountSettingsScreen() {
  const theme = useAppTheme();
  const routeFetchKey = useRelayRouteFetchKey();
  const data = useLazyLoadQuery<accountSettingsOperationsQuery>(
    accountSettingsQuery,
    {},
    { fetchKey: routeFetchKey, fetchPolicy: 'store-and-network' },
  );
  const [removedIdentityIds, setRemovedIdentityIds] = useState<
    Readonly<Record<string, true>>
  >({});
  const [extraExportRequests, setExtraExportRequests] = useState<
    ReadonlyArray<DataExportRequest>
  >([]);
  const [updatedDeletionRequests, setUpdatedDeletionRequests] = useState<
    ReadonlyArray<AccountDeletionRequest>
  >([]);
  const [activeAction, setActiveAction] = useState<AccountSettingsAction | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const activeActionRef = useRef<AccountSettingsAction | null>(null);
  const [commitUnlinkIdentity] =
    useMutation<accountSettingsOperationsUnlinkIdentityMutation>(
      accountSettingsUnlinkIdentityMutation,
    );
  const [commitRequestDataExport] =
    useMutation<accountSettingsOperationsRequestDataExportMutation>(
      accountSettingsRequestDataExportMutation,
    );
  const [commitRequestAccountDeletion] =
    useMutation<accountSettingsOperationsRequestAccountDeletionMutation>(
      accountSettingsRequestAccountDeletionMutation,
    );
  const [commitCancelAccountDeletion] =
    useMutation<accountSettingsOperationsCancelAccountDeletionMutation>(
      accountSettingsCancelAccountDeletionMutation,
    );

  const identities = useMemo(
    () =>
      readConnectionNodes<AccountSettingsIdentity>(data.viewer?.userIdentities)
        .filter((identity) => removedIdentityIds[identity.id] !== true),
    [data.viewer?.userIdentities, removedIdentityIds],
  );
  const dataExportRequests = useMemo(
    () =>
      mergeById(
        readConnectionNodes<DataExportRequest>(data.viewerDataExportRequests),
        extraExportRequests,
      ),
    [data.viewerDataExportRequests, extraExportRequests],
  );
  const accountDeletionRequests = useMemo(
    () =>
      mergeById(
        readConnectionNodes<AccountDeletionRequest>(
          data.viewerAccountDeletionRequests,
        ),
        updatedDeletionRequests,
      ),
    [data.viewerAccountDeletionRequests, updatedDeletionRequests],
  );

  const startAction = (action: AccountSettingsAction): boolean => {
    if (activeActionRef.current !== null) {
      return false;
    }

    activeActionRef.current = action;
    setActiveAction(action);
    setError(null);
    return true;
  };

  const finishAction = () => {
    activeActionRef.current = null;
    setActiveAction(null);
  };

  const handleResult = (result: ErrorOnlyResult): boolean => {
    if (!result || result.errors?.length) {
      setError(formatAccountSettingsMutationErrors(result?.errors));
      return false;
    }

    return true;
  };

  const handleMissingMutationResource = (): false => {
    setError(formatAccountSettingsMutationErrors(null));
    return false;
  };

  const unlinkIdentity = (identity: AccountSettingsIdentity) => {
    const action = `unlink-identity:${identity.id}` as const;

    if (!startAction(action)) {
      return;
    }

    commitUnlinkIdentity({
      variables: { input: { userIdentityId: identity.id } },
      onCompleted: (payload) => {
        finishAction();
        const result = payload.unlinkViewerIdentity;

        if (!handleResult(result)) {
          return;
        }

        setRemovedIdentityIds((current) => ({
          ...current,
          [result?.userIdentity?.id ?? identity.id]: true,
        }));
      },
      onError: () => {
        finishAction();
        setError(formatAccountSettingsMutationErrors(null));
      },
    });
  };

  const requestDataExport = () => {
    const action = 'request-data-export';

    if (!startAction(action)) {
      return;
    }

    commitRequestDataExport({
      variables: { input: {} },
      onCompleted: (payload) => {
        finishAction();
        const result = payload.requestViewerDataExport;
        const request = result?.dataExportRequest;

        if (!handleResult(result)) {
          return;
        }

        if (!request) {
          handleMissingMutationResource();
          return;
        }

        setExtraExportRequests((current) =>
          mergeById(current, [request]),
        );
      },
      onError: () => {
        finishAction();
        setError(formatAccountSettingsMutationErrors(null));
      },
    });
  };

  const requestAccountDeletion = () => {
    const action = 'request-account-deletion';

    if (!startAction(action)) {
      return;
    }

    commitRequestAccountDeletion({
      variables: { input: {} },
      onCompleted: (payload) => {
        finishAction();
        const result = payload.requestViewerAccountDeletion;
        const request = result?.accountDeletionRequest;

        if (!handleResult(result)) {
          return;
        }

        if (!request) {
          handleMissingMutationResource();
          return;
        }

        setUpdatedDeletionRequests((current) =>
          mergeById(current, [request]),
        );
      },
      onError: () => {
        finishAction();
        setError(formatAccountSettingsMutationErrors(null));
      },
    });
  };

  const cancelAccountDeletion = (request: AccountDeletionRequest) => {
    const action = `cancel-deletion:${request.id}` as const;

    if (!startAction(action)) {
      return;
    }

    commitCancelAccountDeletion({
      variables: { input: { accountDeletionRequestId: request.id } },
      onCompleted: (payload) => {
        finishAction();
        const result = payload.cancelViewerAccountDeletionRequest;
        const request = result?.accountDeletionRequest;

        if (!handleResult(result)) {
          return;
        }

        if (!request) {
          handleMissingMutationResource();
          return;
        }

        setUpdatedDeletionRequests((current) =>
          mergeById(current, [request]),
        );
      },
      onError: () => {
        finishAction();
        setError(formatAccountSettingsMutationErrors(null));
      },
    });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Settings"
        title="Account settings"
        subtitle="Manage account access, exports, and deletion requests."
      />
      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Account
        </Text>
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {data.viewer?.email ?? 'Signed-in viewer'}
        </Text>
      </AppCard>
      <LinkedIdentitiesCard
        activeAction={activeAction}
        identities={identities}
        onUnlink={unlinkIdentity}
      />
      <DataExportRequestsCard
        activeAction={activeAction}
        onRequest={requestDataExport}
        requests={dataExportRequests}
      />
      <AccountDeletionRequestsCard
        activeAction={activeAction}
        onCancel={cancelAccountDeletion}
        onRequest={requestAccountDeletion}
        requests={accountDeletionRequests}
      />
    </ScrollView>
  );
}

function LinkedIdentitiesCard({
  activeAction,
  identities,
  onUnlink,
}: {
  activeAction: AccountSettingsAction | null;
  identities: ReadonlyArray<AccountSettingsIdentity>;
  onUnlink: (identity: AccountSettingsIdentity) => void;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Linked identities
      </Text>
      {identities.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No linked identities are available.
        </Text>
      ) : (
        <View style={styles.list}>
          {identities.map((identity) => {
            const action = `unlink-identity:${identity.id}` as const;

            return (
              <View
                key={identity.id}
                style={[styles.requestRow, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                  {identityProviderLabel(identity)}
                </Text>
                <Text
                  style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}
                >
                  Linked {formatOptionalDate(identity.insertedAt)}
                </Text>
                {identity.canUnlink ? (
                  <AppButton
                    disabled={activeAction !== null}
                    label={activeAction === action ? 'Unlinking...' : 'Unlink'}
                    onPress={() => onUnlink(identity)}
                    variant="secondary"
                  />
                ) : (
                  <Text
                    style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}
                  >
                    Add another sign-in method before unlinking this identity.
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

function DataExportRequestsCard({
  activeAction,
  onRequest,
  requests,
}: {
  activeAction: AccountSettingsAction | null;
  onRequest: () => void;
  requests: ReadonlyArray<DataExportRequest>;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Data exports
      </Text>
      <AppButton
        disabled={activeAction !== null}
        label={
          activeAction === 'request-data-export'
            ? 'Requesting...'
            : 'Request data export'
        }
        onPress={onRequest}
      />
      {requests.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No data export requests yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {requests.map((request) => (
            <View
              key={request.id}
              style={[styles.requestRow, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                {dataExportStatusLabel(request.status)}
              </Text>
              <Text
                style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}
              >
                {request.format} export requested{' '}
                {formatOptionalDate(request.requestedAt)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </AppCard>
  );
}

function AccountDeletionRequestsCard({
  activeAction,
  onCancel,
  onRequest,
  requests,
}: {
  activeAction: AccountSettingsAction | null;
  onCancel: (request: AccountDeletionRequest) => void;
  onRequest: () => void;
  requests: ReadonlyArray<AccountDeletionRequest>;
}) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Account deletion
      </Text>
      <AppButton
        disabled={activeAction !== null}
        label={
          activeAction === 'request-account-deletion'
            ? 'Requesting...'
            : 'Request account deletion'
        }
        onPress={onRequest}
        variant="secondary"
      />
      {requests.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No account deletion requests yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {requests.map((request) => {
            const cancelAction = `cancel-deletion:${request.id}` as const;

            return (
              <View
                key={request.id}
                style={[styles.requestRow, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                  {accountDeletionStatusLabel(request.status)}
                </Text>
                <Text
                  style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}
                >
                  Scheduled purge {formatOptionalDate(request.scheduledPurgeAt)}
                </Text>
                {canCancelAccountDeletionRequest(request.status) ? (
                  <AppButton
                    disabled={activeAction !== null}
                    label={
                      activeAction === cancelAction
                        ? 'Canceling...'
                        : 'Cancel request'
                    }
                    onPress={() => onCancel(request)}
                    variant="secondary"
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

function mergeById<Node extends { readonly id: string }>(
  base: ReadonlyArray<Node>,
  next: ReadonlyArray<Node>,
): ReadonlyArray<Node> {
  const byId = new Map(base.map((node) => [node.id, node]));

  for (const node of next) {
    byId.set(node.id, node);
  }

  return Array.from(byId.values());
}

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return 'date unavailable';
  }

  return value.split('T', 1)[0] ?? value;
}
