/**
 * @generated SignedSource<<c98ee910737241de6e7e4834defa3c8f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RequestPasswordResetInput = {
  email: string;
};
export type passwordRecoveryOperationsRequestMutation$variables = {
  input: RequestPasswordResetInput;
};
export type passwordRecoveryOperationsRequestMutation$data = {
  readonly requestPasswordReset: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type passwordRecoveryOperationsRequestMutation = {
  response: passwordRecoveryOperationsRequestMutation$data;
  variables: passwordRecoveryOperationsRequestMutation$variables;
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
    "concreteType": "RequestPasswordResetPayload",
    "kind": "LinkedField",
    "name": "requestPasswordReset",
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
    "name": "passwordRecoveryOperationsRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "passwordRecoveryOperationsRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3355128e384ad2f570fcc88e470fe595",
    "id": null,
    "metadata": {},
    "name": "passwordRecoveryOperationsRequestMutation",
    "operationKind": "mutation",
    "text": "mutation passwordRecoveryOperationsRequestMutation(\n  $input: RequestPasswordResetInput!\n) {\n  requestPasswordReset(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ad04a93b9e528509646144f6bc50983";

export default node;
