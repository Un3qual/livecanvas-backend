/**
 * @generated SignedSource<<445d540ff6b8418d8b107c8acc2d5b72>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MuteUserInput = {
  mutedId: string;
};
export type socialControlOperationsMuteUserMutation$variables = {
  input: MuteUserInput;
};
export type socialControlOperationsMuteUserMutation$data = {
  readonly muteUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type socialControlOperationsMuteUserMutation = {
  response: socialControlOperationsMuteUserMutation$data;
  variables: socialControlOperationsMuteUserMutation$variables;
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
    "concreteType": "MuteUserPayload",
    "kind": "LinkedField",
    "name": "muteUser",
    "plural": false,
    "selections": [
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
    "name": "socialControlOperationsMuteUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "socialControlOperationsMuteUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "cc08718ffec32c9b951ed980cee78ccf",
    "id": null,
    "metadata": {},
    "name": "socialControlOperationsMuteUserMutation",
    "operationKind": "mutation",
    "text": "mutation socialControlOperationsMuteUserMutation(\n  $input: MuteUserInput!\n) {\n  muteUser(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a97edbc68520323f532dffb6111c40ac";

export default node;
