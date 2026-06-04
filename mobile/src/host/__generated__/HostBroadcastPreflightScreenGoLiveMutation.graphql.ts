/**
 * @generated SignedSource<<c08245f98763634492cbccaa22ae7986>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type GoLiveSessionInput = {
  liveSessionId: string;
};
export type HostBroadcastPreflightScreenGoLiveMutation$variables = {
  input: GoLiveSessionInput;
};
export type HostBroadcastPreflightScreenGoLiveMutation$data = {
  readonly goLiveSession: {
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
export type HostBroadcastPreflightScreenGoLiveMutation = {
  response: HostBroadcastPreflightScreenGoLiveMutation$data;
  variables: HostBroadcastPreflightScreenGoLiveMutation$variables;
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
    "concreteType": "GoLiveSessionPayload",
    "kind": "LinkedField",
    "name": "goLiveSession",
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
    "name": "HostBroadcastPreflightScreenGoLiveMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "HostBroadcastPreflightScreenGoLiveMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "29fef014dbe9af4b373752763a4e58b3",
    "id": null,
    "metadata": {},
    "name": "HostBroadcastPreflightScreenGoLiveMutation",
    "operationKind": "mutation",
    "text": "mutation HostBroadcastPreflightScreenGoLiveMutation(\n  $input: GoLiveSessionInput!\n) {\n  goLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "291b39cfd5dc752281aa78d0cef10cc7";

export default node;
