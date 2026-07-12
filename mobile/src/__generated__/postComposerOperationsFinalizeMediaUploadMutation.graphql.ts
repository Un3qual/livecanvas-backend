/**
 * @generated SignedSource<<b2af213d9f2b27d065772f9be793416b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type FinalizeMediaUploadInput = {
  mediaAssetId: string;
};
export type postComposerOperationsFinalizeMediaUploadMutation$variables = {
  input: FinalizeMediaUploadInput;
};
export type postComposerOperationsFinalizeMediaUploadMutation$data = {
  readonly finalizeMediaUpload: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly mediaAsset: {
      readonly id: string;
      readonly processingState: MediaProcessingState;
    } | null | undefined;
  } | null | undefined;
};
export type postComposerOperationsFinalizeMediaUploadMutation = {
  response: postComposerOperationsFinalizeMediaUploadMutation$data;
  variables: postComposerOperationsFinalizeMediaUploadMutation$variables;
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
    "concreteType": "FinalizeMediaUploadPayload",
    "kind": "LinkedField",
    "name": "finalizeMediaUpload",
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
            "name": "processingState",
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
    "name": "postComposerOperationsFinalizeMediaUploadMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "postComposerOperationsFinalizeMediaUploadMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eb9bfdee38ca0c2ce4bedc3c4d56265c",
    "id": null,
    "metadata": {},
    "name": "postComposerOperationsFinalizeMediaUploadMutation",
    "operationKind": "mutation",
    "text": "mutation postComposerOperationsFinalizeMediaUploadMutation(\n  $input: FinalizeMediaUploadInput!\n) {\n  finalizeMediaUpload(input: $input) {\n    mediaAsset {\n      id\n      processingState\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a0c4940f7118c028cd8e6a2c08685e3d";

export default node;
