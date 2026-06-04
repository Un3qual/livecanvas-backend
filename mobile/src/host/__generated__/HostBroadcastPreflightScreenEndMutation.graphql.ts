/**
 * @generated SignedSource<<46844abb6f64e098d7d882dc54ebe8e6>>
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
export type HostBroadcastPreflightScreenEndMutation$variables = {
  input: EndLiveSessionInput;
};
export type HostBroadcastPreflightScreenEndMutation$data = {
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
export type HostBroadcastPreflightScreenEndMutation = {
  response: HostBroadcastPreflightScreenEndMutation$data;
  variables: HostBroadcastPreflightScreenEndMutation$variables;
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
    "name": "HostBroadcastPreflightScreenEndMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "HostBroadcastPreflightScreenEndMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6b99596f3e044bc443cba491043f6005",
    "id": null,
    "metadata": {},
    "name": "HostBroadcastPreflightScreenEndMutation",
    "operationKind": "mutation",
    "text": "mutation HostBroadcastPreflightScreenEndMutation(\n  $input: EndLiveSessionInput!\n) {\n  endLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e196cff3718ae744b62a3420576e3238";

export default node;
