/**
 * @generated SignedSource<<c2de271d0b8e4b1695c290fb6506373e>>
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
        readonly email: string | null | undefined;
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
v5 = {
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "email",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 3
  }
],
v7 = [
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
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": (v6/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "followers",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": "followers(first:3)"
},
v9 = {
  "alias": null,
  "args": (v6/*: any*/),
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "following",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": "following(first:3)"
},
v10 = [
  {
    "kind": "Variable",
    "name": "creatorId",
    "variableName": "id"
  }
],
v11 = {
  "alias": null,
  "args": (v10/*: any*/),
  "kind": "ScalarField",
  "name": "relationshipState",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": (v10/*: any*/),
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
              (v5/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v11/*: any*/),
      (v12/*: any*/)
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
              (v8/*: any*/),
              (v9/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v11/*: any*/),
      (v12/*: any*/)
    ]
  },
  "params": {
    "cacheID": "d68f77aa09f00de65cd24fef02341329",
    "id": null,
    "metadata": {},
    "name": "OtherUserProfileScreenQuery",
    "operationKind": "query",
    "text": "query OtherUserProfileScreenQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      privacyMode\n      currentLiveSession {\n        id\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n          email\n        }\n      }\n      followers(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n      following(first: 3) {\n        pageInfo {\n          hasNextPage\n        }\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n  relationshipState(creatorId: $id)\n  isMuted(creatorId: $id)\n}\n"
  }
};
})();

(node as any).hash = "173b9fec9572d45c7369419e80ff9422";

export default node;
