/**
 * @generated SignedSource<<fec4ff3f41bd5b778b9b772ea6772451>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type contentSurfaceOperationsLiveSessionFields$data = {
  readonly channelTopic: string | null | undefined;
  readonly endedAt: string | null | undefined;
  readonly host: {
    readonly displayName: string | null | undefined;
    readonly email: string | null | undefined;
    readonly id: string;
    readonly username: string | null | undefined;
  };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt: string | null | undefined;
  readonly status: LiveSessionStatus;
  readonly visibility: LiveSessionVisibility;
  readonly " $fragmentType": "contentSurfaceOperationsLiveSessionFields";
};
export type contentSurfaceOperationsLiveSessionFields$key = {
  readonly " $data"?: contentSurfaceOperationsLiveSessionFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"contentSurfaceOperationsLiveSessionFields">;
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
  "name": "contentSurfaceOperationsLiveSessionFields",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "channelTopic",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
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
      "name": "insertedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "host",
      "plural": false,
      "selections": [
        (v0/*: any*/),
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
    }
  ],
  "type": "LiveSession",
  "abstractKey": null
};
})();

(node as any).hash = "7725dfadfb1f059421252b0264502f76";

export default node;
