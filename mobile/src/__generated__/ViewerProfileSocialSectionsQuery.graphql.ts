/**
 * @generated SignedSource<<a9143facaac0fe00ae8b49c375c4b2ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type FollowState = "ACCEPTED" | "REQUESTED" | "%future added value";
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type ViewerProfileSocialSectionsQuery$variables = Record<PropertyKey, never>;
export type ViewerProfileSocialSectionsQuery$data = {
  readonly viewer: {
    readonly followers: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly following: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly id: string;
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
export type ViewerProfileSocialSectionsQuery = {
  response: ViewerProfileSocialSectionsQuery$data;
  variables: ViewerProfileSocialSectionsQuery$variables;
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
    "value": 10
  }
],
v2 = [
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
    "args": null,
    "kind": "ScalarField",
    "name": "privacyMode",
    "storageKey": null
  }
],
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "PageInfo",
    "kind": "LinkedField",
    "name": "pageInfo",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hasNextPage",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
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
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
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
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserConnection",
        "kind": "LinkedField",
        "name": "followers",
        "plural": false,
        "selections": (v3/*: any*/),
        "storageKey": "followers(first:10)"
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserConnection",
        "kind": "LinkedField",
        "name": "following",
        "plural": false,
        "selections": (v3/*: any*/),
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
                "selections": (v2/*: any*/),
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
    "name": "ViewerProfileSocialSectionsQuery",
    "selections": (v4/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ViewerProfileSocialSectionsQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "1932ae484e2fcbb4444215c10fbbc167",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileSocialSectionsQuery",
    "operationKind": "query",
    "text": "query ViewerProfileSocialSectionsQuery {\n  viewer {\n    id\n    followers(first: 10) {\n      pageInfo {\n        hasNextPage\n      }\n      edges {\n        node {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n    following(first: 10) {\n      pageInfo {\n        hasNextPage\n      }\n      edges {\n        node {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n  }\n  viewerPendingFollowRequests(first: 3) {\n    edges {\n      node {\n        id\n        state\n        requestedAt\n        follower {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b197a9bdb4f5c44b85817f7e49a50e06";

export default node;
