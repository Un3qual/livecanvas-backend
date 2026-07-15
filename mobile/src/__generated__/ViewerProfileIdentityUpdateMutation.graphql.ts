/**
 * @generated SignedSource<<56140712a29f314e163fde4e506d4966>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpdateViewerProfileIdentityInput = {
  displayName: string;
  username: string;
};
export type ViewerProfileIdentityUpdateMutation$variables = {
  input: UpdateViewerProfileIdentityInput;
};
export type ViewerProfileIdentityUpdateMutation$data = {
  readonly updateViewerProfileIdentity: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly user: {
      readonly displayName: string | null | undefined;
      readonly id: string;
      readonly username: string | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type ViewerProfileIdentityUpdateMutation = {
  response: ViewerProfileIdentityUpdateMutation$data;
  variables: ViewerProfileIdentityUpdateMutation$variables;
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
    "concreteType": "UpdateViewerProfileIdentityPayload",
    "kind": "LinkedField",
    "name": "updateViewerProfileIdentity",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "user",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "displayName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "username",
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
    "name": "ViewerProfileIdentityUpdateMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileIdentityUpdateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9727b5cdbcdca1338736c5a13a0f4d12",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileIdentityUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileIdentityUpdateMutation(\n  $input: UpdateViewerProfileIdentityInput!\n) {\n  updateViewerProfileIdentity(input: $input) {\n    user {\n      id\n      displayName\n      username\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a98cbec024407f6e7a9d897fcb48416";

export default node;
