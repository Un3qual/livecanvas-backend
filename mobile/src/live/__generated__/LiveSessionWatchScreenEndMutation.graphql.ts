/**
 * @generated SignedSource<<5ffaac34687e74742cd546b1e787a07b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type EndLiveSessionInput = {
  liveSessionId: string;
  recordingMediaAssetId?: string | null | undefined;
};
export type LiveSessionWatchScreenEndMutation$variables = {
  input: EndLiveSessionInput;
};
export type LiveSessionWatchScreenEndMutation$data = {
  readonly endLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly liveSession: {
      readonly channelTopic: string | null | undefined;
      readonly endedAt: string | null | undefined;
      readonly id: string;
      readonly status: LiveSessionStatus;
    } | null | undefined;
  } | null | undefined;
};
export type LiveSessionWatchScreenEndMutation = {
  response: LiveSessionWatchScreenEndMutation$data;
  variables: LiveSessionWatchScreenEndMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EndLiveSessionPayload",
    "kind": "LinkedField",
    "name": "endLiveSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSession",
        "kind": "LinkedField",
        "name": "liveSession",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
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
            "name": "endedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "channelTopic",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserError",
        "kind": "LinkedField",
        "name": "errors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "field",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "message",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LiveSessionWatchScreenEndMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LiveSessionWatchScreenEndMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d15e636bd1e45a5cb0d3d7d6c5d0d86c",
    "id": null,
    "metadata": {},
    "name": "LiveSessionWatchScreenEndMutation",
    "operationKind": "mutation",
    "text": "mutation LiveSessionWatchScreenEndMutation(\n  $input: EndLiveSessionInput!\n) {\n  endLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      endedAt\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9a7ff1ca9605de950f6d998ffd75ba68";

export default node;
