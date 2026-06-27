/**
 * @generated SignedSource<<342e42eca0f7909654f1f68a5c1367b4>>
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
export type liveSessionWatchOperationsPrepareMediaMutation$variables = {
  input: PrepareLiveMediaSessionInput;
};
export type liveSessionWatchOperationsPrepareMediaMutation$data = {
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
      readonly id: string;
      readonly status: LiveSessionStatus;
    } | null | undefined;
    readonly signalingTopic: string | null | undefined;
  } | null | undefined;
};
export type liveSessionWatchOperationsPrepareMediaMutation = {
  response: liveSessionWatchOperationsPrepareMediaMutation$data;
  variables: liveSessionWatchOperationsPrepareMediaMutation$variables;
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
    "name": "liveSessionWatchOperationsPrepareMediaMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionWatchOperationsPrepareMediaMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "db782efc9e53a3776f0eaca0b0241c40",
    "id": null,
    "metadata": {},
    "name": "liveSessionWatchOperationsPrepareMediaMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionWatchOperationsPrepareMediaMutation(\n  $input: PrepareLiveMediaSessionInput!\n) {\n  prepareLiveMediaSession(input: $input) {\n    liveSession {\n      id\n      status\n    }\n    signalingTopic\n    iceServers {\n      urls\n      username\n      credential\n      credentialType\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c4ef516e6922400eaa62713cd2ea20d4";

export default node;
