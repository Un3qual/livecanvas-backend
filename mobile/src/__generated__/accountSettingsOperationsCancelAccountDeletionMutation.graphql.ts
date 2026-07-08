/**
 * @generated SignedSource<<51f34bc183c2e3128d166be3bc79b7dc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccountDeletionRequestStatus = "CANCELED" | "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING" | "SCHEDULED" | "%future added value";
export type CancelViewerAccountDeletionRequestInput = {
  accountDeletionRequestId: string;
};
export type accountSettingsOperationsCancelAccountDeletionMutation$variables = {
  input: CancelViewerAccountDeletionRequestInput;
};
export type accountSettingsOperationsCancelAccountDeletionMutation$data = {
  readonly cancelViewerAccountDeletionRequest: {
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
export type accountSettingsOperationsCancelAccountDeletionMutation = {
  response: accountSettingsOperationsCancelAccountDeletionMutation$data;
  variables: accountSettingsOperationsCancelAccountDeletionMutation$variables;
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
    "concreteType": "CancelViewerAccountDeletionRequestPayload",
    "kind": "LinkedField",
    "name": "cancelViewerAccountDeletionRequest",
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
    "name": "accountSettingsOperationsCancelAccountDeletionMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "accountSettingsOperationsCancelAccountDeletionMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a7465f18cb5033faf8081c8d1b7b9262",
    "id": null,
    "metadata": {},
    "name": "accountSettingsOperationsCancelAccountDeletionMutation",
    "operationKind": "mutation",
    "text": "mutation accountSettingsOperationsCancelAccountDeletionMutation(\n  $input: CancelViewerAccountDeletionRequestInput!\n) {\n  cancelViewerAccountDeletionRequest(input: $input) {\n    accountDeletionRequest {\n      id\n      status\n      requestedAt\n      scheduledPurgeAt\n      completedAt\n      failureReason\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3fd4f8e8783b8044983656f4d8009fc2";

export default node;
