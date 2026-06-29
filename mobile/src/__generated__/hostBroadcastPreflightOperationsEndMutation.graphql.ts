/**
 * @generated SignedSource<<e928352f3b3e3a0cca010888a6a05e54>>
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
export type hostBroadcastPreflightOperationsEndMutation$variables = {
  input: EndLiveSessionInput;
};
export type hostBroadcastPreflightOperationsEndMutation$data = {
  readonly endLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly liveSession: {
      readonly channelTopic: string | null | undefined;
      readonly id: string;
      readonly status: LiveSessionStatus;
    } | null | undefined;
  } | null | undefined;
};
export type hostBroadcastPreflightOperationsEndMutation = {
  response: hostBroadcastPreflightOperationsEndMutation$data;
  variables: hostBroadcastPreflightOperationsEndMutation$variables;
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
    "name": "hostBroadcastPreflightOperationsEndMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "hostBroadcastPreflightOperationsEndMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "29fa60b79d3745a35150fe999919ac6c",
    "id": null,
    "metadata": {},
    "name": "hostBroadcastPreflightOperationsEndMutation",
    "operationKind": "mutation",
    "text": "mutation hostBroadcastPreflightOperationsEndMutation(\n  $input: EndLiveSessionInput!\n) {\n  endLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cadd42f7feef5eec8c1c45e4b3c4084e";

export default node;
