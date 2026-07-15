/**
 * @generated SignedSource<<058540bdaf9640485c2d0f33d214c807>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type PostKind = "STANDARD" | "STORY" | "%future added value";
export type PostVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type storyViewerOperationsQuery$variables = {
  id: string;
  storyAfter?: string | null | undefined;
  storyFirst: number;
};
export type storyViewerOperationsQuery$data = {
  readonly node: {
    readonly __typename: "Post";
    readonly author: {
      readonly email: string | null | undefined;
      readonly id: string;
      readonly storyFeed: {
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
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
  readonly viewer: {
    readonly id: string;
  } | null | undefined;
};
export type storyViewerOperationsQuery = {
  response: storyViewerOperationsQuery$data;
  variables: storyViewerOperationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "storyAfter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "storyFirst"
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
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "bodyText",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "visibility",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expiresAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "insertedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v11 = {
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
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "author",
  "plural": false,
  "selections": [
    (v1/*: any*/),
    (v10/*: any*/),
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "after",
          "variableName": "storyAfter"
        },
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "storyFirst"
        }
      ],
      "concreteType": "PostConnection",
      "kind": "LinkedField",
      "name": "storyFeed",
      "plural": false,
      "selections": [
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
                (v5/*: any*/),
                (v6/*: any*/),
                (v7/*: any*/),
                (v8/*: any*/),
                (v9/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "author",
                  "plural": false,
                  "selections": [
                    (v1/*: any*/),
                    (v10/*: any*/)
                  ],
                  "storageKey": null
                },
                (v11/*: any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "storyViewerOperationsQuery",
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
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v12/*: any*/),
              (v11/*: any*/)
            ],
            "type": "Post",
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
    "name": "storyViewerOperationsQuery",
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
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v12/*: any*/),
              (v11/*: any*/)
            ],
            "type": "Post",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3547e8b0f6b488f9ef3714e6aba52902",
    "id": null,
    "metadata": {},
    "name": "storyViewerOperationsQuery",
    "operationKind": "query",
    "text": "query storyViewerOperationsQuery(\n  $id: ID!\n  $storyAfter: String\n  $storyFirst: Int!\n) {\n  viewer {\n    id\n  }\n  node(id: $id) {\n    __typename\n    ... on Post {\n      id\n      kind\n      bodyText\n      visibility\n      expiresAt\n      insertedAt\n      author {\n        id\n        email\n        storyFeed(first: $storyFirst, after: $storyAfter) {\n          edges {\n            node {\n              id\n              kind\n              bodyText\n              visibility\n              expiresAt\n              insertedAt\n              author {\n                id\n                email\n              }\n              mediaAssets {\n                id\n                mimeType\n                processingState\n                publicUrl\n              }\n            }\n          }\n          pageInfo {\n            endCursor\n            hasNextPage\n          }\n        }\n      }\n      mediaAssets {\n        id\n        mimeType\n        processingState\n        publicUrl\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e715e3de074b750777032751ea013fd5";

export default node;
