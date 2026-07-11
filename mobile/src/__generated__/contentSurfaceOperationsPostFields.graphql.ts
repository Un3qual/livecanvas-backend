/**
 * @generated SignedSource<<80c5aced879e2d1322b211d65b1cc556>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type MediaProcessingState = "FAILED" | "PENDING_UPLOAD" | "PROCESSED" | "UPLOADED" | "%future added value";
export type PostKind = "STANDARD" | "STORY" | "%future added value";
export type PostVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type contentSurfaceOperationsPostFields$data = {
  readonly author: {
    readonly email: string | null | undefined;
    readonly id: string;
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
  readonly " $fragmentType": "contentSurfaceOperationsPostFields";
};
export type contentSurfaceOperationsPostFields$key = {
  readonly " $data"?: contentSurfaceOperationsPostFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"contentSurfaceOperationsPostFields">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "contentSurfaceOperationsPostFields",
  "selections": [
    (v0/*: any*/),
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
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "email",
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
        (v0/*: any*/),
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
  "type": "Post",
  "abstractKey": null
};
})();

(node as any).hash = "49971f34a55af7728258cda128f80d32";

export default node;
