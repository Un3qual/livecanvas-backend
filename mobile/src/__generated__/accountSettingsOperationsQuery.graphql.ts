/**
 * @generated SignedSource<<e0512d39e3a0ebe94b52961057ecb83a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccountDeletionRequestStatus = "CANCELED" | "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING" | "SCHEDULED" | "%future added value";
export type AuthProvider = "APPLE" | "GOOGLE" | "MAGIC_LINK" | "PASSKEY" | "PASSWORD" | "%future added value";
export type DataExportRequestFormat = "JSON" | "%future added value";
export type DataExportRequestStatus = "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING" | "%future added value";
export type accountSettingsOperationsQuery$variables = Record<PropertyKey, never>;
export type accountSettingsOperationsQuery$data = {
  readonly viewer: {
    readonly email: string | null | undefined;
    readonly id: string;
    readonly userIdentities: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly authProvider: AuthProvider | null | undefined;
          readonly canUnlink: boolean;
          readonly id: string;
          readonly insertedAt: string;
          readonly provider: string;
        } | null | undefined;
      } | null | undefined> | null | undefined;
    } | null | undefined;
  } | null | undefined;
  readonly viewerAccountDeletionRequests: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly completedAt: string | null | undefined;
        readonly failureReason: string | null | undefined;
        readonly id: string;
        readonly requestedAt: string;
        readonly scheduledPurgeAt: string;
        readonly status: AccountDeletionRequestStatus;
      } | null | undefined;
    } | null | undefined> | null | undefined;
  } | null | undefined;
  readonly viewerDataExportRequests: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly completedAt: string | null | undefined;
        readonly failureReason: string | null | undefined;
        readonly format: DataExportRequestFormat;
        readonly id: string;
        readonly requestedAt: string;
        readonly status: DataExportRequestStatus;
      } | null | undefined;
    } | null | undefined> | null | undefined;
  } | null | undefined;
};
export type accountSettingsOperationsQuery = {
  response: accountSettingsOperationsQuery$data;
  variables: accountSettingsOperationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "requestedAt",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "completedAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failureReason",
  "storageKey": null
},
v6 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "email",
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserIdentityConnection",
        "kind": "LinkedField",
        "name": "userIdentities",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "UserIdentityEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "UserIdentity",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v0/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "provider",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "authProvider",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "canUnlink",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "insertedAt",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "userIdentities(first:20)"
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": (v1/*: any*/),
    "concreteType": "DataExportRequestConnection",
    "kind": "LinkedField",
    "name": "viewerDataExportRequests",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DataExportRequestEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DataExportRequest",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v0/*: any*/),
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "format",
                "storageKey": null
              },
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "viewerDataExportRequests(first:20)"
  },
  {
    "alias": null,
    "args": (v1/*: any*/),
    "concreteType": "AccountDeletionRequestConnection",
    "kind": "LinkedField",
    "name": "viewerAccountDeletionRequests",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "AccountDeletionRequestEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AccountDeletionRequest",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v0/*: any*/),
              (v2/*: any*/),
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "scheduledPurgeAt",
                "storageKey": null
              },
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "viewerAccountDeletionRequests(first:20)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "accountSettingsOperationsQuery",
    "selections": (v6/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "accountSettingsOperationsQuery",
    "selections": (v6/*: any*/)
  },
  "params": {
    "cacheID": "f888b4aa6d51c6629638c8aa6163be7c",
    "id": null,
    "metadata": {},
    "name": "accountSettingsOperationsQuery",
    "operationKind": "query",
    "text": "query accountSettingsOperationsQuery {\n  viewer {\n    id\n    email\n    userIdentities(first: 20) {\n      edges {\n        node {\n          id\n          provider\n          authProvider\n          canUnlink\n          insertedAt\n        }\n      }\n    }\n  }\n  viewerDataExportRequests(first: 20) {\n    edges {\n      node {\n        id\n        status\n        format\n        requestedAt\n        completedAt\n        failureReason\n      }\n    }\n  }\n  viewerAccountDeletionRequests(first: 20) {\n    edges {\n      node {\n        id\n        status\n        requestedAt\n        scheduledPurgeAt\n        completedAt\n        failureReason\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6910cfafe3aad90cc13fd0b2f2aa94d2";

export default node;
