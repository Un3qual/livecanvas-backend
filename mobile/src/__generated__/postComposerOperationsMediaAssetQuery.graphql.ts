/**
 * @generated SignedSource<<1f0837eda070326e7377d970e5455f61>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type postComposerOperationsMediaAssetQuery$variables = {
  id: string;
};
export type postComposerOperationsMediaAssetQuery$data = {
  readonly mediaAsset: {
    readonly id: string;
    readonly processingState: MediaProcessingState;
  } | null | undefined;
};
export type postComposerOperationsMediaAssetQuery = {
  response: postComposerOperationsMediaAssetQuery$data;
  variables: postComposerOperationsMediaAssetQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
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
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "postComposerOperationsMediaAssetQuery",
    "selections": (v1/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "postComposerOperationsMediaAssetQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "66551dd0b4bc576cdb5750e5c767d3c3",
    "id": null,
    "metadata": {},
    "name": "postComposerOperationsMediaAssetQuery",
    "operationKind": "query",
    "text": "query postComposerOperationsMediaAssetQuery(\n  $id: ID!\n) {\n  mediaAsset(id: $id) {\n    id\n    processingState\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3c2ee6efd251090a638b095c483bd24";

export default node;
