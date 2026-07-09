/**
 * @generated SignedSource<<7c82c30bbd93ebb180b4b7355c262994>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeletePostInput = {
  postId: string;
};
export type postOwnerControlOperationsDeletePostMutation$variables = {
  input: DeletePostInput;
};
export type postOwnerControlOperationsDeletePostMutation$data = {
  readonly deletePost: {
    readonly deletedPostId: string | null | undefined;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type postOwnerControlOperationsDeletePostMutation = {
  response: postOwnerControlOperationsDeletePostMutation$data;
  variables: postOwnerControlOperationsDeletePostMutation$variables;
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
    "concreteType": "DeletePostPayload",
    "kind": "LinkedField",
    "name": "deletePost",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "deletedPostId",
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
    "name": "postOwnerControlOperationsDeletePostMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "postOwnerControlOperationsDeletePostMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "15900b4a01dda5d551e0ecbebfc3fb8f",
    "id": null,
    "metadata": {},
    "name": "postOwnerControlOperationsDeletePostMutation",
    "operationKind": "mutation",
    "text": "mutation postOwnerControlOperationsDeletePostMutation(\n  $input: DeletePostInput!\n) {\n  deletePost(input: $input) {\n    deletedPostId\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "06ce32ce82d1219a030b42b34753c3f2";

export default node;
