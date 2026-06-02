/**
 * @generated SignedSource<<aa54762da37e97488c1e5f3319826ab0>>
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
export type LiveSessionWatchScreenQuery$variables = {
  id: string;
};
export type LiveSessionWatchScreenQuery$data = {
  readonly node: {
    readonly __typename: "LiveSession";
    readonly channelTopic: string | null | undefined;
    readonly endedAt: string | null | undefined;
    readonly host: {
      readonly email: string | null | undefined;
      readonly id: string;
    };
    readonly id: string;
    readonly insertedAt: string;
    readonly recordingMediaAsset: {
      readonly id: string;
      readonly processingState: MediaProcessingState;
      readonly publicUrl: string | null | undefined;
    } | null | undefined;
    readonly startedAt: string | null | undefined;
    readonly status: LiveSessionStatus;
    readonly visibility: LiveSessionVisibility;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
};
export type LiveSessionWatchScreenQuery = {
  response: LiveSessionWatchScreenQuery$data;
  variables: LiveSessionWatchScreenQuery$variables;
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
  "name": "channelTopic",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
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
  "name": "insertedAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endedAt",
  "storageKey": null
},
v10 = {
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
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "LiveSessionRecordingMediaAsset",
  "kind": "LinkedField",
  "name": "recordingMediaAsset",
  "plural": false,
  "selections": [
    (v3/*: any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LiveSessionWatchScreenQuery",
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
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/)
            ],
            "type": "LiveSession",
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
    "name": "LiveSessionWatchScreenQuery",
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
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/)
            ],
            "type": "LiveSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "63f715dcf31b3b3d1005be0a596d92d7",
    "id": null,
    "metadata": {},
    "name": "LiveSessionWatchScreenQuery",
    "operationKind": "query",
    "text": "query LiveSessionWatchScreenQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on LiveSession {\n      id\n      channelTopic\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        email\n      }\n      recordingMediaAsset {\n        id\n        processingState\n        publicUrl\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "57bcd12a35f80e3c63c95f59be195bd7";

export default node;
