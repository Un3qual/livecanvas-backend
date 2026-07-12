/**
 * @generated SignedSource<<4ffd980f483d7009281f249def971c7e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConsumeContactInviteInput = {
  token: string;
};
export type contactInviteOperationsConsumeMutation$variables = {
  input: ConsumeContactInviteInput;
};
export type contactInviteOperationsConsumeMutation$data = {
  readonly consumeContactInvite: {
    readonly consumed: boolean;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type contactInviteOperationsConsumeMutation = {
  response: contactInviteOperationsConsumeMutation$data;
  variables: contactInviteOperationsConsumeMutation$variables;
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
    "concreteType": "ConsumeContactInvitePayload",
    "kind": "LinkedField",
    "name": "consumeContactInvite",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "consumed",
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
    "name": "contactInviteOperationsConsumeMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "contactInviteOperationsConsumeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "924a628a508a70901d63b1c3782d055c",
    "id": null,
    "metadata": {},
    "name": "contactInviteOperationsConsumeMutation",
    "operationKind": "mutation",
    "text": "mutation contactInviteOperationsConsumeMutation(\n  $input: ConsumeContactInviteInput!\n) {\n  consumeContactInvite(input: $input) {\n    consumed\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1412ae37b7e4cbfb9ef6eaee609c7f3c";

export default node;
