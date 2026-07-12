/**
 * @generated SignedSource<<137d061cc2b9094dec28b9cdca103c19>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type UploadHttpMethod = "POST" | "PUT" | "%future added value";
export type RequestMediaUploadInput = {
  mimeType: string;
};
export type postComposerOperationsRequestMediaUploadMutation$variables = {
  input: RequestMediaUploadInput;
};
export type postComposerOperationsRequestMediaUploadMutation$data = {
  readonly requestMediaUpload: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly mediaAsset: {
      readonly id: string;
      readonly mimeType: string;
      readonly processingState: MediaProcessingState;
    } | null | undefined;
    readonly signedUpload: {
      readonly expiresAt: string;
      readonly headers: ReadonlyArray<{
        readonly name: string;
        readonly value: string;
      }>;
      readonly method: UploadHttpMethod;
      readonly url: string;
    } | null | undefined;
  } | null | undefined;
};
export type postComposerOperationsRequestMediaUploadMutation = {
  response: postComposerOperationsRequestMediaUploadMutation$data;
  variables: postComposerOperationsRequestMediaUploadMutation$variables;
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
    "concreteType": "RequestMediaUploadPayload",
    "kind": "LinkedField",
    "name": "requestMediaUpload",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "MediaAsset",
        "kind": "LinkedField",
        "name": "mediaAsset",
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
            "name": "mimeType",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "processingState",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SignedUpload",
        "kind": "LinkedField",
        "name": "signedUpload",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "method",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "url",
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
            "concreteType": "SignedUploadHeader",
            "kind": "LinkedField",
            "name": "headers",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "value",
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
    "name": "postComposerOperationsRequestMediaUploadMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "postComposerOperationsRequestMediaUploadMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e998aaf1f91517af7d29bb00edaa749e",
    "id": null,
    "metadata": {},
    "name": "postComposerOperationsRequestMediaUploadMutation",
    "operationKind": "mutation",
    "text": "mutation postComposerOperationsRequestMediaUploadMutation(\n  $input: RequestMediaUploadInput!\n) {\n  requestMediaUpload(input: $input) {\n    mediaAsset {\n      id\n      mimeType\n      processingState\n    }\n    signedUpload {\n      method\n      url\n      expiresAt\n      headers {\n        name\n        value\n      }\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0541392761adbaf49302d57fdf73afc3";

export default node;
