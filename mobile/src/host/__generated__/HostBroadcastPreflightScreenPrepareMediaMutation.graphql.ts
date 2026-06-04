/**
 * @generated SignedSource<<47bd1328e189f794e48d53d9fd76f20a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveMediaIceServerCredentialType = "OAUTH" | "PASSWORD" | "%future added value";
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type PrepareLiveMediaSessionInput = {
  liveSessionId: string;
};
export type HostBroadcastPreflightScreenPrepareMediaMutation$variables = {
  input: PrepareLiveMediaSessionInput;
};
export type HostBroadcastPreflightScreenPrepareMediaMutation$data = {
  readonly prepareLiveMediaSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly iceServers: ReadonlyArray<{
      readonly credential: string | null | undefined;
      readonly credentialType: LiveMediaIceServerCredentialType | null | undefined;
      readonly urls: ReadonlyArray<string>;
      readonly username: string | null | undefined;
    }>;
    readonly liveSession: {
      readonly channelTopic: string | null | undefined;
      readonly id: string;
      readonly status: LiveSessionStatus;
    } | null | undefined;
    readonly signalingTopic: string | null | undefined;
  } | null | undefined;
};
export type HostBroadcastPreflightScreenPrepareMediaMutation = {
  response: HostBroadcastPreflightScreenPrepareMediaMutation$data;
  variables: HostBroadcastPreflightScreenPrepareMediaMutation$variables;
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
    "concreteType": "PrepareLiveMediaSessionPayload",
    "kind": "LinkedField",
    "name": "prepareLiveMediaSession",
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
        "kind": "ScalarField",
        "name": "signalingTopic",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveMediaIceServer",
        "kind": "LinkedField",
        "name": "iceServers",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "urls",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "username",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "credential",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "credentialType",
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
    "name": "HostBroadcastPreflightScreenPrepareMediaMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "HostBroadcastPreflightScreenPrepareMediaMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "47e58cf71864f192f37101e7d492e5ba",
    "id": null,
    "metadata": {},
    "name": "HostBroadcastPreflightScreenPrepareMediaMutation",
    "operationKind": "mutation",
    "text": "mutation HostBroadcastPreflightScreenPrepareMediaMutation(\n  $input: PrepareLiveMediaSessionInput!\n) {\n  prepareLiveMediaSession(input: $input) {\n    liveSession {\n      id\n      status\n      channelTopic\n    }\n    signalingTopic\n    iceServers {\n      urls\n      username\n      credential\n      credentialType\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6a34324bcf38e46b1ad166560985f1af";

export default node;
