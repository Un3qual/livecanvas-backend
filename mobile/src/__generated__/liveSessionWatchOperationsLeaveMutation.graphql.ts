/**
 * @generated SignedSource<<99aab7149363f4970b5f267b16c02655>>
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
export type liveSessionWatchOperationsLeaveMutation$variables = {
  input: LeaveLiveSessionInput;
};
export type liveSessionWatchOperationsLeaveMutation$data = {
  readonly leaveLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly left: boolean;
  } | null | undefined;
};
export type liveSessionWatchOperationsLeaveMutation = {
  response: liveSessionWatchOperationsLeaveMutation$data;
  variables: liveSessionWatchOperationsLeaveMutation$variables;
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
    "name": "liveSessionWatchOperationsLeaveMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionWatchOperationsLeaveMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ef14141801e28c7d819bcce9ec39b41e",
    "id": null,
    "metadata": {},
    "name": "liveSessionWatchOperationsLeaveMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionWatchOperationsLeaveMutation(\n  $input: LeaveLiveSessionInput!\n) {\n  leaveLiveSession(input: $input) {\n    left\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "89a73375e6f616383b79adf13f7decd5";

export default node;
