/**
 * @generated SignedSource<<91aa04a8b1a5caf5a853c3deb33db3d9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UnfollowUserInput = {
  followedId: string;
};
export type socialControlOperationsUnfollowUserMutation$variables = {
  input: UnfollowUserInput;
};
export type socialControlOperationsUnfollowUserMutation$data = {
  readonly unfollowUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type socialControlOperationsUnfollowUserMutation = {
  response: socialControlOperationsUnfollowUserMutation$data;
  variables: socialControlOperationsUnfollowUserMutation$variables;
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
    "concreteType": "UnfollowUserPayload",
    "kind": "LinkedField",
    "name": "unfollowUser",
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
    "name": "socialControlOperationsUnfollowUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "socialControlOperationsUnfollowUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a7b4e438cb83ee85075dc99874e199f7",
    "id": null,
    "metadata": {},
    "name": "socialControlOperationsUnfollowUserMutation",
    "operationKind": "mutation",
    "text": "mutation socialControlOperationsUnfollowUserMutation(\n  $input: UnfollowUserInput!\n) {\n  unfollowUser(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9758c49f7f23d20ead6d3f5a9cda17cd";

export default node;
