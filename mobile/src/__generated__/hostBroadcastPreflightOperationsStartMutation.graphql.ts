/**
 * @generated SignedSource<<08ac8216cdb8859216e59a4e15c7b93c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type StartLiveSessionInput = {
  visibility?: LiveSessionVisibility | null | undefined;
};
export type hostBroadcastPreflightOperationsStartMutation$variables = {
  input: StartLiveSessionInput;
};
export type hostBroadcastPreflightOperationsStartMutation$data = {
  readonly startLiveSession: {
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
export type hostBroadcastPreflightOperationsStartMutation = {
  response: hostBroadcastPreflightOperationsStartMutation$data;
  variables: hostBroadcastPreflightOperationsStartMutation$variables;
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
    "concreteType": "StartLiveSessionPayload",
    "kind": "LinkedField",
    "name": "startLiveSession",
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
    "name": "hostBroadcastPreflightOperationsStartMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "hostBroadcastPreflightOperationsStartMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "010f7ff6888fac639b45865be9d75b5b",
    "id": null,
    "metadata": {},
    "name": "hostBroadcastPreflightOperationsStartMutation",
    "operationKind": "mutation",
    "text": "mutation hostBroadcastPreflightOperationsStartMutation(\n  $input: StartLiveSessionInput!\n) {\n  startLiveSession(input: $input) {\n    liveSession {\n      id\n      status\n      channelTopic\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "269242b0a88e9b8f68232898c000f5ae";

export default node;
