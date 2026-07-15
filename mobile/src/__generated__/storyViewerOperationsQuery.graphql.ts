/**
 * @generated SignedSource<<287c18c8a7a9286a9abbea8cc4046f3b>>
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
    "name": "storyFirst"
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
  "name": "kind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "bodyText",
  "storageKey": null
},
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
  "name": "expiresAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "insertedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "PostMediaAsset",
  "kind": "LinkedField",
  "name": "mediaAssets",
  "plural": true,
  "selections": [
    (v3/*: any*/),
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
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "author",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    (v9/*: any*/),
    {
      "alias": null,
      "args": [
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
                (v3/*: any*/),
                (v4/*: any*/),
                (v5/*: any*/),
                (v6/*: any*/),
                (v7/*: any*/),
                (v8/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "author",
                  "plural": false,
                  "selections": [
                    (v3/*: any*/),
                    (v9/*: any*/)
                  ],
                  "storageKey": null
                },
                (v10/*: any*/)
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
              (v8/*: any*/),
              (v11/*: any*/),
              (v10/*: any*/)
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
              (v8/*: any*/),
              (v11/*: any*/),
              (v10/*: any*/)
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
    "cacheID": "604e46e1c713c2476e14fbfa0a60cc21",
    "id": null,
    "metadata": {},
    "name": "storyViewerOperationsQuery",
    "operationKind": "query",
    "text": "query storyViewerOperationsQuery(\n  $id: ID!\n  $storyFirst: Int!\n) {\n  node(id: $id) {\n    __typename\n    ... on Post {\n      id\n      kind\n      bodyText\n      visibility\n      expiresAt\n      insertedAt\n      author {\n        id\n        email\n        storyFeed(first: $storyFirst) {\n          edges {\n            node {\n              id\n              kind\n              bodyText\n              visibility\n              expiresAt\n              insertedAt\n              author {\n                id\n                email\n              }\n              mediaAssets {\n                id\n                mimeType\n                processingState\n                publicUrl\n              }\n            }\n          }\n          pageInfo {\n            endCursor\n            hasNextPage\n          }\n        }\n      }\n      mediaAssets {\n        id\n        mimeType\n        processingState\n        publicUrl\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3fd50dd80b9f0bc7dbfea32939cfdb11";

export default node;
