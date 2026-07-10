/**
 * @generated SignedSource<<7d70fe6d7076c8d1279eae6c5095246a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type BlockUserInput = {
  blockedId: string;
};
export type socialControlOperationsBlockUserMutation$variables = {
  input: BlockUserInput;
};
export type socialControlOperationsBlockUserMutation$data = {
  readonly blockUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type socialControlOperationsBlockUserMutation = {
  response: socialControlOperationsBlockUserMutation$data;
  variables: socialControlOperationsBlockUserMutation$variables;
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
    "concreteType": "BlockUserPayload",
    "kind": "LinkedField",
    "name": "blockUser",
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
    "name": "socialControlOperationsBlockUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "socialControlOperationsBlockUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ec4656fd747f4e64daf7a7d0cc0d23ed",
    "id": null,
    "metadata": {},
    "name": "socialControlOperationsBlockUserMutation",
    "operationKind": "mutation",
    "text": "mutation socialControlOperationsBlockUserMutation(\n  $input: BlockUserInput!\n) {\n  blockUser(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "df8f6e8e62d699a21595f8851411903e";

export default node;
