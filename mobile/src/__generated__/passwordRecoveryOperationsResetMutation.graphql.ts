/**
 * @generated SignedSource<<60bc55f2881afde48dd8cb1746aba7de>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ResetPasswordInput = {
  password: string;
  passwordConfirmation: string;
  token: string;
};
export type passwordRecoveryOperationsResetMutation$variables = {
  input: ResetPasswordInput;
};
export type passwordRecoveryOperationsResetMutation$data = {
  readonly resetPassword: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly reset: boolean;
  } | null | undefined;
};
export type passwordRecoveryOperationsResetMutation = {
  response: passwordRecoveryOperationsResetMutation$data;
  variables: passwordRecoveryOperationsResetMutation$variables;
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
    "concreteType": "ResetPasswordPayload",
    "kind": "LinkedField",
    "name": "resetPassword",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "reset",
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
    "name": "passwordRecoveryOperationsResetMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "passwordRecoveryOperationsResetMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4ff8c0beac4ddb1da5c6a089ec6bf505",
    "id": null,
    "metadata": {},
    "name": "passwordRecoveryOperationsResetMutation",
    "operationKind": "mutation",
    "text": "mutation passwordRecoveryOperationsResetMutation(\n  $input: ResetPasswordInput!\n) {\n  resetPassword(input: $input) {\n    reset\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "802cb6c427ab5ec31498484b3a4ec4b8";

export default node;
