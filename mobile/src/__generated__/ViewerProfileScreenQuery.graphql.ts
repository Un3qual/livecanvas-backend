/**
 * @generated SignedSource<<1446ca8a1cec763c3ac7282b896fdc24>>
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
        readonly email: string | null | undefined;
        readonly id: string;
      };
      readonly id: string;
      readonly insertedAt: string;
      readonly startedAt: string | null | undefined;
      readonly status: LiveSessionStatus;
      readonly visibility: LiveSessionVisibility;
    } | null | undefined;
    readonly email: string | null | undefined;
    readonly id: string;
    readonly privacyMode: UserPrivacyMode;
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
  "name": "email",
  "storageKey": null
},
v2 = [
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "privacyMode",
        "storageKey": null
      },
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
              (v1/*: any*/)
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
    "selections": (v2/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ViewerProfileScreenQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "ca2faf8956ba2ab5dcbbc7afe7858b2d",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenQuery",
    "operationKind": "query",
    "text": "query ViewerProfileScreenQuery {\n  viewer {\n    id\n    email\n    privacyMode\n    currentLiveSession {\n      id\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        email\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "52d79f1b1f4e499fb39d21833ab06421";

export default node;
