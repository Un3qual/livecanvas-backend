/**
 * @generated SignedSource<<e5f596a3f9ee5cce63b3e0f0d0d4c1c2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type JoinLiveSessionInput = {
  liveSessionId: string;
};
export type liveSessionWatchOperationsJoinMutation$variables = {
  input: JoinLiveSessionInput;
};
export type liveSessionWatchOperationsJoinMutation$data = {
  readonly joinLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly liveSession: {
      readonly endedAt: string | null | undefined;
      readonly host: {
        readonly displayName: string | null | undefined;
        readonly email: string | null | undefined;
        readonly id: string;
        readonly username: string | null | undefined;
      };
      readonly id: string;
      readonly insertedAt: string;
      readonly startedAt: string | null | undefined;
      readonly status: LiveSessionStatus;
      readonly visibility: LiveSessionVisibility;
    } | null | undefined;
  } | null | undefined;
};
export type liveSessionWatchOperationsJoinMutation = {
  response: liveSessionWatchOperationsJoinMutation$data;
  variables: liveSessionWatchOperationsJoinMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "JoinLiveSessionPayload",
    "kind": "LinkedField",
    "name": "joinLiveSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSession",
        "kind": "LinkedField",
        "name": "liveSession",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
            "name": "visibility",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "insertedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "startedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "host",
            "plural": false,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "displayName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "email",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "username",
                "storageKey": null
              }
            ],
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
    "name": "liveSessionWatchOperationsJoinMutation",
    "selections": (v2/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionWatchOperationsJoinMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "4444c0b112ce40124602533d49d17c5e",
    "id": null,
    "metadata": {},
    "name": "liveSessionWatchOperationsJoinMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionWatchOperationsJoinMutation(\n  $input: JoinLiveSessionInput!\n) {\n  joinLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        displayName\n        email\n        username\n      }\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4329f635fb2e6a922bf780da78c5c81b";

export default node;
