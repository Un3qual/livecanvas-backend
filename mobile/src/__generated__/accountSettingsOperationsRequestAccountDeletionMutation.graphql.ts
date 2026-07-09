/**
 * @generated SignedSource<<3e8f9c0696f8ae6b3c7b693f7ca5145d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccountDeletionRequestStatus = "CANCELED" | "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING" | "SCHEDULED" | "%future added value";
export type RequestViewerAccountDeletionInput = {
  gracePeriodSeconds?: number | null | undefined;
};
export type accountSettingsOperationsRequestAccountDeletionMutation$variables = {
  input: RequestViewerAccountDeletionInput;
};
export type accountSettingsOperationsRequestAccountDeletionMutation$data = {
  readonly requestViewerAccountDeletion: {
    readonly accountDeletionRequest: {
      readonly completedAt: string | null | undefined;
      readonly failureReason: string | null | undefined;
      readonly id: string;
      readonly requestedAt: string;
      readonly scheduledPurgeAt: string;
      readonly status: AccountDeletionRequestStatus;
    } | null | undefined;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type accountSettingsOperationsRequestAccountDeletionMutation = {
  response: accountSettingsOperationsRequestAccountDeletionMutation$data;
  variables: accountSettingsOperationsRequestAccountDeletionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "RequestViewerAccountDeletionPayload",
    "kind": "LinkedField",
    "name": "requestViewerAccountDeletion",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "AccountDeletionRequest",
        "kind": "LinkedField",
        "name": "accountDeletionRequest",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "status",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "requestedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "scheduledPurgeAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "completedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "failureReason",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserError",
        "kind": "LinkedField",
        "name": "errors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "field",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "message",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "accountSettingsOperationsRequestAccountDeletionMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "accountSettingsOperationsRequestAccountDeletionMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8248fd5990ad4198b00ec0f15803a0f8",
    "id": null,
    "metadata": {},
    "name": "accountSettingsOperationsRequestAccountDeletionMutation",
    "operationKind": "mutation",
    "text": "mutation accountSettingsOperationsRequestAccountDeletionMutation(\n  $input: RequestViewerAccountDeletionInput!\n) {\n  requestViewerAccountDeletion(input: $input) {\n    accountDeletionRequest {\n      id\n      status\n      requestedAt\n      scheduledPurgeAt\n      completedAt\n      failureReason\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "bf43e46bc9523989f238586feac2241a";

export default node;
