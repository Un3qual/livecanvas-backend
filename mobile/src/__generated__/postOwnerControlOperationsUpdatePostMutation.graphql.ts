/**
 * @generated SignedSource<<1c95effd2b55a3591030529057b499df>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type PostKind = "STANDARD" | "STORY" | "%future added value";
export type PostVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type UpdatePostInput = {
  bodyText?: string | null | undefined;
  postId: string;
  visibility?: PostVisibility | null | undefined;
};
export type postOwnerControlOperationsUpdatePostMutation$variables = {
  input: UpdatePostInput;
};
export type postOwnerControlOperationsUpdatePostMutation$data = {
  readonly updatePost: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly post: {
      readonly author: {
        readonly displayName: string | null | undefined;
        readonly email: string | null | undefined;
        readonly id: string;
        readonly username: string | null | undefined;
      };
      readonly bodyText: string | null | undefined;
      readonly expiresAt: string | null | undefined;
      readonly id: string;
      readonly insertedAt: string;
      readonly kind: PostKind;
      readonly mediaAssets: ReadonlyArray<{
        readonly id: string;
        readonly mimeType: string;
        readonly processingState: MediaProcessingState;
        readonly publicUrl: string | null | undefined;
      }>;
      readonly visibility: PostVisibility;
    } | null | undefined;
  } | null | undefined;
};
export type postOwnerControlOperationsUpdatePostMutation = {
  response: postOwnerControlOperationsUpdatePostMutation$data;
  variables: postOwnerControlOperationsUpdatePostMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpdatePostPayload",
    "kind": "LinkedField",
    "name": "updatePost",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Post",
        "kind": "LinkedField",
        "name": "post",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kind",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "bodyText",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "visibility",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "expiresAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "insertedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "author",
            "plural": false,
            "selections": [
              (v1/*: any*/),
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
                "name": "email",
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
            "concreteType": "PostMediaAsset",
            "kind": "LinkedField",
            "name": "mediaAssets",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "mimeType",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "processingState",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "publicUrl",
                "storageKey": null
              }
            ],
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
    "name": "postOwnerControlOperationsUpdatePostMutation",
    "selections": (v2/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "postOwnerControlOperationsUpdatePostMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "721199c6c3977f547ed86ff072aaa46d",
    "id": null,
    "metadata": {},
    "name": "postOwnerControlOperationsUpdatePostMutation",
    "operationKind": "mutation",
    "text": "mutation postOwnerControlOperationsUpdatePostMutation(\n  $input: UpdatePostInput!\n) {\n  updatePost(input: $input) {\n    post {\n      id\n      kind\n      bodyText\n      visibility\n      expiresAt\n      insertedAt\n      author {\n        id\n        displayName\n        email\n        username\n      }\n      mediaAssets {\n        id\n        mimeType\n        processingState\n        publicUrl\n      }\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1332a210bc812ed7dcb94fb39f247945";

export default node;
