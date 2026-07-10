/**
 * @generated SignedSource<<bd4846de1bbfa87562d2c1d90473db5e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UnblockUserInput = {
  blockedId: string;
};
export type socialControlOperationsUnblockUserMutation$variables = {
  input: UnblockUserInput;
};
export type socialControlOperationsUnblockUserMutation$data = {
  readonly unblockUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type socialControlOperationsUnblockUserMutation = {
  response: socialControlOperationsUnblockUserMutation$data;
  variables: socialControlOperationsUnblockUserMutation$variables;
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
    "concreteType": "UnblockUserPayload",
    "kind": "LinkedField",
    "name": "unblockUser",
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
    "name": "socialControlOperationsUnblockUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "socialControlOperationsUnblockUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5146dc5d014370890e251a36df7c6e06",
    "id": null,
    "metadata": {},
    "name": "socialControlOperationsUnblockUserMutation",
    "operationKind": "mutation",
    "text": "mutation socialControlOperationsUnblockUserMutation(\n  $input: UnblockUserInput!\n) {\n  unblockUser(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "307c138e4dae20127692969049561930";

export default node;
