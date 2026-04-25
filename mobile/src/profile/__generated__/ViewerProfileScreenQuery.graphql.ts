/**
 * @generated SignedSource<<3ecc46d7ef4607774182d142fa8e3473>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type FollowState = "ACCEPTED" | "REQUESTED" | "%future added value";
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type ViewerProfileScreenQuery$variables = Record<PropertyKey, never>;
export type ViewerProfileScreenQuery$data = {
  readonly viewer: {
    readonly email: string | null | undefined;
    readonly followers: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        } | null | undefined;
      } | null | undefined> | null | undefined;
    } | null | undefined;
    readonly following: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        } | null | undefined;
      } | null | undefined> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly insertedAt: string;
    readonly privacyMode: UserPrivacyMode;
  } | null | undefined;
  readonly viewerPendingFollowRequests: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly follower: {
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        };
        readonly id: string;
        readonly requestedAt: string;
        readonly state: FollowState;
      } | null | undefined;
    } | null | undefined> | null | undefined;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "privacyMode",
  "storageKey": null
},
v3 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 10
  }
],
v4 = [
  (v0/*: any*/),
  (v1/*: any*/),
  (v2/*: any*/)
],
v5 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v4/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
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
      (v1/*: any*/),
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "insertedAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "UserConnection",
        "kind": "LinkedField",
        "name": "followers",
        "plural": false,
        "selections": (v5/*: any*/),
        "storageKey": "followers(first:10)"
      },
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "UserConnection",
        "kind": "LinkedField",
        "name": "following",
        "plural": false,
        "selections": (v5/*: any*/),
        "storageKey": "following(first:10)"
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 3
      }
    ],
    "concreteType": "FollowRequestConnection",
    "kind": "LinkedField",
    "name": "viewerPendingFollowRequests",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "FollowRequestEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "FollowRequest",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v0/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "state",
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
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "follower",
                "plural": false,
                "selections": (v4/*: any*/),
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "viewerPendingFollowRequests(first:3)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerProfileScreenQuery",
    "selections": (v6/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ViewerProfileScreenQuery",
    "selections": (v6/*: any*/)
  },
  "params": {
    "cacheID": "79ec9f23a47819fd7460fc5db3951e42",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenQuery",
    "operationKind": "query",
    "text": "query ViewerProfileScreenQuery {\n  viewer {\n    id\n    email\n    privacyMode\n    insertedAt\n    followers(first: 10) {\n      edges {\n        node {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n    following(first: 10) {\n      edges {\n        node {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n  }\n  viewerPendingFollowRequests(first: 3) {\n    edges {\n      node {\n        id\n        state\n        requestedAt\n        follower {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ef887e574edd04674181083692867820";

export default node;
