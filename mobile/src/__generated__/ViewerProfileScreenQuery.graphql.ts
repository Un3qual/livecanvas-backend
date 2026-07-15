/**
 * @generated SignedSource<<0864b1bd1655b4a09f65933af4f15617>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type ViewerProfileScreenQuery$variables = Record<PropertyKey, never>;
export type ViewerProfileScreenQuery$data = {
  readonly viewer: {
    readonly currentLiveSession: {
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
    readonly displayName: string | null | undefined;
    readonly email: string | null | undefined;
    readonly id: string;
    readonly privacyMode: UserPrivacyMode;
    readonly username: string | null | undefined;
  } | null | undefined;
};
export type ViewerProfileScreenQuery = {
  response: ViewerProfileScreenQuery$data;
  variables: ViewerProfileScreenQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "privacyMode",
        "storageKey": null
      },
      (v3/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSession",
        "kind": "LinkedField",
        "name": "currentLiveSession",
        "plural": false,
        "selections": [
          (v0/*: any*/),
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
              (v0/*: any*/),
              (v1/*: any*/),
              (v2/*: any*/),
              (v3/*: any*/)
            ],
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerProfileScreenQuery",
    "selections": (v4/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ViewerProfileScreenQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "fc1b707d67bfe32cae40b861aa7a4bf7",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenQuery",
    "operationKind": "query",
    "text": "query ViewerProfileScreenQuery {\n  viewer {\n    id\n    displayName\n    email\n    privacyMode\n    username\n    currentLiveSession {\n      id\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        displayName\n        email\n        username\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "25ad31e9585fd9a8d1e0a8f3dceea535";

export default node;
