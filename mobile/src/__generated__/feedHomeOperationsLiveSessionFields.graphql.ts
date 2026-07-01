/**
 * @generated SignedSource<<c0d64f0a15058d87dc8b36ec65ff0421>>
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
export type feedHomeOperationsLiveSessionFields$data = {
  readonly channelTopic: string | null | undefined;
  readonly endedAt: string | null | undefined;
  readonly host: {
    readonly email: string | null | undefined;
    readonly id: string;
  };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt: string | null | undefined;
  readonly status: LiveSessionStatus;
  readonly visibility: LiveSessionVisibility;
  readonly " $fragmentType": "feedHomeOperationsLiveSessionFields";
};
export type feedHomeOperationsLiveSessionFields$key = {
  readonly " $data"?: feedHomeOperationsLiveSessionFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"feedHomeOperationsLiveSessionFields">;
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
  "name": "feedHomeOperationsLiveSessionFields",
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
          "name": "email",
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

(node as any).hash = "776a9ec5f763b6989b79d44b8841a107";

export default node;
