/**
 * @generated SignedSource<<d92f5a3762c1d5d396019a4bbc97bdb2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LeaveLiveSessionInput = {
  liveSessionId: string;
};
export type LiveSessionWatchScreenLeaveMutation$variables = {
  input: LeaveLiveSessionInput;
};
export type LiveSessionWatchScreenLeaveMutation$data = {
  readonly leaveLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly left: boolean;
  } | null | undefined;
};
export type LiveSessionWatchScreenLeaveMutation = {
  response: LiveSessionWatchScreenLeaveMutation$data;
  variables: LiveSessionWatchScreenLeaveMutation$variables;
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
    "concreteType": "LeaveLiveSessionPayload",
    "kind": "LinkedField",
    "name": "leaveLiveSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "left",
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
    "name": "LiveSessionWatchScreenLeaveMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LiveSessionWatchScreenLeaveMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0c77171d48947afee77e71a91cb10b83",
    "id": null,
    "metadata": {},
    "name": "LiveSessionWatchScreenLeaveMutation",
    "operationKind": "mutation",
    "text": "mutation LiveSessionWatchScreenLeaveMutation(\n  $input: LeaveLiveSessionInput!\n) {\n  leaveLiveSession(input: $input) {\n    left\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b53448f777d5e78e32afa73e2e3890d6";

export default node;
