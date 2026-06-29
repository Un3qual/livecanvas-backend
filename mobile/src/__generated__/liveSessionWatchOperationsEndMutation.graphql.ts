/**
 * @generated SignedSource<<30d53ee92305bfe5a819d2afb3bb6bb5>>
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
export type liveSessionWatchOperationsEndMutation$variables = {
  input: EndLiveSessionInput;
};
export type liveSessionWatchOperationsEndMutation$data = {
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
export type liveSessionWatchOperationsEndMutation = {
  response: liveSessionWatchOperationsEndMutation$data;
  variables: liveSessionWatchOperationsEndMutation$variables;
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
    "name": "liveSessionWatchOperationsEndMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionWatchOperationsEndMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a4108812bae132c7cd552dc76be60fc2",
    "id": null,
    "metadata": {},
    "name": "liveSessionWatchOperationsEndMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionWatchOperationsEndMutation(\n  $input: EndLiveSessionInput!\n) {\n  endLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      endedAt\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "38c2c17076fc9af2f028d00a00aee38f";

export default node;
