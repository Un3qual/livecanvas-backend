/**
 * @generated SignedSource<<0e0812a3fca4e156b720abe1c6a8a658>>
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
  readonly isBlockedByViewer: boolean;
  readonly isMuted: boolean;
  readonly node: {
    readonly __typename: "User";
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
    readonly username: string | null | undefined;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
  readonly relationshipState: RelationshipState;
  readonly viewer: {
    readonly id: string;
  } | null | undefined;
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
  "name": "displayName",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "privacyMode",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v7 = {
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
      "selections": [
        (v3/*: any*/),
        (v4/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "email",
          "storageKey": null
        },
        (v6/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 3
  }
],
v9 = [
  (v3/*: any*/)
],
v10 = [
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
        "selections": (v9/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v11 = {
  "alias": null,
  "args": (v8/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "followers",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": "followers(first:3)"
},
v12 = {
  "alias": null,
  "args": (v8/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "following",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": "following(first:3)"
},
v13 = [
  {
    "kind": "Variable",
    "name": "creatorId",
    "variableName": "id"
  }
],
v14 = {
  "alias": null,
  "args": (v13/*: any*/),
  "kind": "ScalarField",
  "name": "relationshipState",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": (v13/*: any*/),
  "kind": "ScalarField",
  "name": "isBlockedByViewer",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": (v13/*: any*/),
  "kind": "ScalarField",
  "name": "isMuted",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "viewer",
  "plural": false,
  "selections": (v9/*: any*/),
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
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v14/*: any*/),
      (v15/*: any*/),
      (v16/*: any*/),
      (v17/*: any*/)
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
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v14/*: any*/),
      (v15/*: any*/),
      (v16/*: any*/),
      (v17/*: any*/)
    ]
  },
  "params": {
    "cacheID": "8b47f993f4e17d06f9069e9acd09a829",
    "id": null,
    "metadata": {},
    "name": "OtherUserProfileScreenQuery",
    "operationKind": "query",
    "text": "query OtherUserProfileScreenQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      displayName\n      privacyMode\n      username\n      currentLiveSession {\n        id\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n          displayName\n          email\n          username\n        }\n      }\n      followers(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n      following(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n  relationshipState(creatorId: $id)\n  isBlockedByViewer(creatorId: $id)\n  isMuted(creatorId: $id)\n  viewer {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4496d0a4a78bdd70f8354e170f3ebb9b";

export default node;
