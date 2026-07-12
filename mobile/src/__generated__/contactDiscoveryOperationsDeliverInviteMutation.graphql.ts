/**
 * @generated SignedSource<<0abc748271828a87daee129f37f7c7ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeliverViewerContactInviteInput = {
  contactMatchId: string;
};
export type contactDiscoveryOperationsDeliverInviteMutation$variables = {
  input: DeliverViewerContactInviteInput;
};
export type contactDiscoveryOperationsDeliverInviteMutation$data = {
  readonly deliverViewerContactInvite: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type contactDiscoveryOperationsDeliverInviteMutation = {
  response: contactDiscoveryOperationsDeliverInviteMutation$data;
  variables: contactDiscoveryOperationsDeliverInviteMutation$variables;
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
    "concreteType": "DeliverViewerContactInvitePayload",
    "kind": "LinkedField",
    "name": "deliverViewerContactInvite",
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
    "name": "contactDiscoveryOperationsDeliverInviteMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "contactDiscoveryOperationsDeliverInviteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "92390c0ce867c2d86be15dc6cf9e4779",
    "id": null,
    "metadata": {},
    "name": "contactDiscoveryOperationsDeliverInviteMutation",
    "operationKind": "mutation",
    "text": "mutation contactDiscoveryOperationsDeliverInviteMutation(\n  $input: DeliverViewerContactInviteInput!\n) {\n  deliverViewerContactInvite(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3eed0b759d87785a2e5c6dae17bdd6aa";

export default node;
