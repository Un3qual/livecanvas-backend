/**
 * @generated SignedSource<<0fd5d5b6001ad55135da5b4bdddaeb0e>>
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
export type feedHomeOperationsQuery$variables = {
  feedAfter?: string | null | undefined;
  feedFirst: number;
  liveFirst: number;
  replayAfter?: string | null | undefined;
  replayFirst: number;
  storyAfter?: string | null | undefined;
  storyFirst: number;
};
export type feedHomeOperationsQuery$data = {
  readonly homeFeed: {
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
  readonly liveNow: {
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
  } | null | undefined;
  readonly replayFeed: {
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
  readonly viewer: {
    readonly currentLiveSession: {
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
    readonly id: string;
  } | null | undefined;
};
export type feedHomeOperationsQuery = {
  response: feedHomeOperationsQuery$data;
  variables: feedHomeOperationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "feedAfter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "feedFirst"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "liveFirst"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "replayAfter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "replayFirst"
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
  "kind": "ScalarField",
  "name": "visibility",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "insertedAt",
  "storageKey": null
},
v4 = [
  (v1/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "email",
    "storageKey": null
  }
],
v5 = [
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
  (v2/*: any*/),
  (v3/*: any*/),
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
    "selections": (v4/*: any*/),
    "storageKey": null
  }
],
v6 = {
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
v7 = [
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
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "expiresAt",
            "storageKey": null
          },
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "author",
            "plural": false,
            "selections": (v4/*: any*/),
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
  (v6/*: any*/)
],
v8 = {
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
      "selections": (v5/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSession",
        "kind": "LinkedField",
        "name": "currentLiveSession",
        "plural": false,
        "selections": (v5/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  },
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
    "selections": (v7/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "after",
        "variableName": "feedAfter"
      },
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "feedFirst"
      }
    ],
    "concreteType": "PostConnection",
    "kind": "LinkedField",
    "name": "homeFeed",
    "plural": false,
    "selections": (v7/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "liveFirst"
      }
    ],
    "concreteType": "LiveSessionConnection",
    "kind": "LinkedField",
    "name": "liveNow",
    "plural": false,
    "selections": [
      (v8/*: any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "after",
        "variableName": "replayAfter"
      },
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "replayFirst"
      }
    ],
    "concreteType": "LiveSessionConnection",
    "kind": "LinkedField",
    "name": "replayFeed",
    "plural": false,
    "selections": [
      (v8/*: any*/),
      (v6/*: any*/)
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "feedHomeOperationsQuery",
    "selections": (v9/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "feedHomeOperationsQuery",
    "selections": (v9/*: any*/)
  },
  "params": {
    "cacheID": "5ab885132e5de3ff2909a30677341498",
    "id": null,
    "metadata": {},
    "name": "feedHomeOperationsQuery",
    "operationKind": "query",
    "text": "query feedHomeOperationsQuery(\n  $feedAfter: String\n  $feedFirst: Int!\n  $liveFirst: Int!\n  $replayAfter: String\n  $replayFirst: Int!\n  $storyAfter: String\n  $storyFirst: Int!\n) {\n  viewer {\n    id\n    currentLiveSession {\n      id\n      channelTopic\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        email\n      }\n    }\n  }\n  storyFeed(first: $storyFirst, after: $storyAfter) {\n    edges {\n      node {\n        id\n        kind\n        bodyText\n        visibility\n        expiresAt\n        insertedAt\n        author {\n          id\n          email\n        }\n        mediaAssets {\n          id\n          mimeType\n          processingState\n          publicUrl\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  homeFeed(first: $feedFirst, after: $feedAfter) {\n    edges {\n      node {\n        id\n        kind\n        bodyText\n        visibility\n        expiresAt\n        insertedAt\n        author {\n          id\n          email\n        }\n        mediaAssets {\n          id\n          mimeType\n          processingState\n          publicUrl\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  liveNow(first: $liveFirst) {\n    edges {\n      node {\n        id\n        channelTopic\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n          email\n        }\n      }\n    }\n  }\n  replayFeed(first: $replayFirst, after: $replayAfter) {\n    edges {\n      node {\n        id\n        channelTopic\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n          email\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3cd662efa13b68ad44f77d607e0a04b";

export default node;
