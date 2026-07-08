/**
 * @generated SignedSource<<f262265b06795a69d0fe86cb1ce50e15>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UnlinkViewerIdentityInput = {
  userIdentityId: string;
};
export type accountSettingsOperationsUnlinkIdentityMutation$variables = {
  input: UnlinkViewerIdentityInput;
};
export type accountSettingsOperationsUnlinkIdentityMutation$data = {
  readonly unlinkViewerIdentity: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly userIdentity: {
      readonly id: string;
    } | null | undefined;
  } | null | undefined;
};
export type accountSettingsOperationsUnlinkIdentityMutation = {
  response: accountSettingsOperationsUnlinkIdentityMutation$data;
  variables: accountSettingsOperationsUnlinkIdentityMutation$variables;
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
    "concreteType": "UnlinkViewerIdentityPayload",
    "kind": "LinkedField",
    "name": "unlinkViewerIdentity",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "UserIdentity",
        "kind": "LinkedField",
        "name": "userIdentity",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
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
    "name": "accountSettingsOperationsUnlinkIdentityMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "accountSettingsOperationsUnlinkIdentityMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "804734a0ddea5748a18b8871325e854e",
    "id": null,
    "metadata": {},
    "name": "accountSettingsOperationsUnlinkIdentityMutation",
    "operationKind": "mutation",
    "text": "mutation accountSettingsOperationsUnlinkIdentityMutation(\n  $input: UnlinkViewerIdentityInput!\n) {\n  unlinkViewerIdentity(input: $input) {\n    userIdentity {\n      id\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c1aa871f80db46e9d0fa52a5b5a12fa";

export default node;
