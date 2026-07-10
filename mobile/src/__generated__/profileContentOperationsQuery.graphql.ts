/**
 * @generated SignedSource<<c0fed6e5901042853c107fe361a2e8be>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type PostKind = "STANDARD" | "STORY" | "%future added value";
export type PostVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type profileContentOperationsQuery$variables = {
  after?: string | null | undefined;
  first: number;
  id: string;
  includePosts: boolean;
  includeReplays: boolean;
  includeStories: boolean;
};
export type profileContentOperationsQuery$data = {
  readonly node: {
    readonly __typename: "User";
    readonly id: string;
    readonly posts?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly author: {
            readonly email: string | null | undefined;
            readonly id: string;
          };
          readonly bodyText: string | null | undefined;
          readonly expiresAt: string | null | undefined;
          readonly id: string;
          readonly insertedAt: string;
          readonly kind: PostKind;
          readonly mediaAssets: ReadonlyArray<{
            readonly id: string;
            readonly mimeType: string;
            readonly processingState: MediaProcessingState;
            readonly publicUrl: string | null | undefined;
          }>;
          readonly visibility: PostVisibility;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly endCursor: string | null | undefined;
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly replayFeed?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly channelTopic: string | null | undefined;
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
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly endCursor: string | null | undefined;
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
    readonly storyFeed?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly author: {
            readonly email: string | null | undefined;
            readonly id: string;
          };
          readonly bodyText: string | null | undefined;
          readonly expiresAt: string | null | undefined;
          readonly id: string;
          readonly insertedAt: string;
          readonly kind: PostKind;
          readonly mediaAssets: ReadonlyArray<{
            readonly id: string;
            readonly mimeType: string;
            readonly processingState: MediaProcessingState;
            readonly publicUrl: string | null | undefined;
          }>;
          readonly visibility: PostVisibility;
        } | null | undefined;
      } | null | undefined> | null | undefined;
      readonly pageInfo: {
        readonly endCursor: string | null | undefined;
        readonly hasNextPage: boolean;
      };
    } | null | undefined;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
  readonly viewer: {
    readonly id: string;
  } | null | undefined;
};
export type profileContentOperationsQuery = {
  response: profileContentOperationsQuery$data;
  variables: profileContentOperationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includePosts"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeReplays"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeStories"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "viewer",
  "plural": false,
  "selections": [
    (v1/*: any*/)
  ],
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "visibility",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "insertedAt",
  "storageKey": null
},
v8 = [
  (v1/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "email",
    "storageKey": null
  }
],
v9 = {
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
      "name": "endCursor",
      "storageKey": null
    },
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
v10 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "PostEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Post",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kind",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "bodyText",
            "storageKey": null
          },
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "expiresAt",
            "storageKey": null
          },
          (v7/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "author",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PostMediaAsset",
            "kind": "LinkedField",
            "name": "mediaAssets",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "mimeType",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "processingState",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "publicUrl",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  (v9/*: any*/)
],
v11 = {
  "condition": "includePosts",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": (v5/*: any*/),
      "concreteType": "PostConnection",
      "kind": "LinkedField",
      "name": "posts",
      "plural": false,
      "selections": (v10/*: any*/),
      "storageKey": null
    }
  ]
},
v12 = {
  "condition": "includeStories",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": (v5/*: any*/),
      "concreteType": "PostConnection",
      "kind": "LinkedField",
      "name": "storyFeed",
      "plural": false,
      "selections": (v10/*: any*/),
      "storageKey": null
    }
  ]
},
v13 = {
  "condition": "includeReplays",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": (v5/*: any*/),
      "concreteType": "LiveSessionConnection",
      "kind": "LinkedField",
      "name": "replayFeed",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "LiveSessionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "LiveSession",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "channelTopic",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "status",
                  "storageKey": null
                },
                (v6/*: any*/),
                (v7/*: any*/),
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
                  "selections": (v8/*: any*/),
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        (v9/*: any*/)
      ],
      "storageKey": null
    }
  ]
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "profileContentOperationsQuery",
    "selections": [
      (v2/*: any*/),
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v1/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "profileContentOperationsQuery",
    "selections": [
      (v2/*: any*/),
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v1/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/)
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "daf48838755628bcc195159fb1b7d320",
    "id": null,
    "metadata": {},
    "name": "profileContentOperationsQuery",
    "operationKind": "query",
    "text": "query profileContentOperationsQuery(\n  $after: String\n  $first: Int!\n  $id: ID!\n  $includePosts: Boolean!\n  $includeReplays: Boolean!\n  $includeStories: Boolean!\n) {\n  viewer {\n    id\n  }\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      posts(first: $first, after: $after) @include(if: $includePosts) {\n        edges {\n          node {\n            id\n            kind\n            bodyText\n            visibility\n            expiresAt\n            insertedAt\n            author {\n              id\n              email\n            }\n            mediaAssets {\n              id\n              mimeType\n              processingState\n              publicUrl\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n      storyFeed(first: $first, after: $after) @include(if: $includeStories) {\n        edges {\n          node {\n            id\n            kind\n            bodyText\n            visibility\n            expiresAt\n            insertedAt\n            author {\n              id\n              email\n            }\n            mediaAssets {\n              id\n              mimeType\n              processingState\n              publicUrl\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n      replayFeed(first: $first, after: $after) @include(if: $includeReplays) {\n        edges {\n          node {\n            id\n            channelTopic\n            status\n            visibility\n            insertedAt\n            startedAt\n            endedAt\n            host {\n              id\n              email\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab89649fb2597796ca1df40efc92baff";

export default node;
