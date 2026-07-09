/**
 * @generated SignedSource<<6aa2997175a8763a47d543ed136d81b2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UnmuteUserInput = {
  mutedId: string;
};
export type socialControlOperationsUnmuteUserMutation$variables = {
  input: UnmuteUserInput;
};
export type socialControlOperationsUnmuteUserMutation$data = {
  readonly unmuteUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type socialControlOperationsUnmuteUserMutation = {
  response: socialControlOperationsUnmuteUserMutation$data;
  variables: socialControlOperationsUnmuteUserMutation$variables;
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
    "concreteType": "UnmuteUserPayload",
    "kind": "LinkedField",
    "name": "unmuteUser",
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
    "name": "socialControlOperationsUnmuteUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "socialControlOperationsUnmuteUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "64b31e284d17d3ff7d8bd7d7ec5792d2",
    "id": null,
    "metadata": {},
    "name": "socialControlOperationsUnmuteUserMutation",
    "operationKind": "mutation",
    "text": "mutation socialControlOperationsUnmuteUserMutation(\n  $input: UnmuteUserInput!\n) {\n  unmuteUser(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab459a727951adaf561cfeab65f9d570";

export default node;
