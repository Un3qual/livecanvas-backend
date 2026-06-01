/**
 * @generated SignedSource<<6a6b4d049e44f6eaeff2277360800bc4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type RelationshipState = "ACCEPTED" | "BLOCKED" | "NONE" | "PUBLIC" | "REQUESTED" | "%future added value";
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type OtherUserProfileScreenQuery$variables = {
  id: string;
};
export type OtherUserProfileScreenQuery$data = {
  readonly isMuted: boolean;
  readonly node: {
    readonly __typename: "User";
    readonly currentLiveSession: {
      readonly endedAt: string | null | undefined;
      readonly host: {
        readonly id: string;
      };
      readonly id: string;
      readonly insertedAt: string;
      readonly startedAt: string | null | undefined;
      readonly status: LiveSessionStatus;
      readonly visibility: LiveSessionVisibility;
    } | null | undefined;
    readonly followers: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly id: string;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly following: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly id: string;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly id: string;
    readonly privacyMode: UserPrivacyMode;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
  readonly relationshipState: RelationshipState;
};
export type OtherUserProfileScreenQuery = {
  response: OtherUserProfileScreenQuery$data;
  variables: OtherUserProfileScreenQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "privacyMode",
  "storageKey": null
},
v5 = [
  (v3/*: any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "LiveSession",
  "kind": "LinkedField",
  "name": "currentLiveSession",
  "plural": false,
  "selections": [
    (v3/*: any*/),
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
      "selections": (v5/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 3
  }
],
v8 = [
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
        "selections": (v5/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v9 = {
  "alias": null,
  "args": (v7/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "followers",
  "plural": false,
  "selections": (v8/*: any*/),
  "storageKey": "followers(first:3)"
},
v10 = {
  "alias": null,
  "args": (v7/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "following",
  "plural": false,
  "selections": (v8/*: any*/),
  "storageKey": "following(first:3)"
},
v11 = [
  {
    "kind": "Variable",
    "name": "creatorId",
    "variableName": "id"
  }
],
v12 = {
  "alias": null,
  "args": (v11/*: any*/),
  "kind": "ScalarField",
  "name": "relationshipState",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": (v11/*: any*/),
  "kind": "ScalarField",
  "name": "isMuted",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "OtherUserProfileScreenQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v6/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v12/*: any*/),
      (v13/*: any*/)
    ],
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "OtherUserProfileScreenQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v6/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v12/*: any*/),
      (v13/*: any*/)
    ]
  },
  "params": {
    "cacheID": "48e3cf06869c79382a2dca03ae5232e9",
    "id": null,
    "metadata": {},
    "name": "OtherUserProfileScreenQuery",
    "operationKind": "query",
    "text": "query OtherUserProfileScreenQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      privacyMode\n      currentLiveSession {\n        id\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n        }\n      }\n      followers(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n      following(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n  relationshipState(creatorId: $id)\n  isMuted(creatorId: $id)\n}\n"
  }
};
})();

(node as any).hash = "55fb09c3b6e74102fcf6dc5b26cdf65a";

export default node;
