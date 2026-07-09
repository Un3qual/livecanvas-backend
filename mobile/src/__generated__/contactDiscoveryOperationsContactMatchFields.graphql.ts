/**
 * @generated SignedSource<<9a9fc9d8285149d16a609b776042e88f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type contactDiscoveryOperationsContactMatchFields$data = {
  readonly contactName: string | null | undefined;
  readonly id: string;
  readonly inviteRecipient: string | null | undefined;
  readonly matchedUsers: ReadonlyArray<{
    readonly email: string | null | undefined;
    readonly id: string;
    readonly privacyMode: UserPrivacyMode;
  }>;
  readonly " $fragmentType": "contactDiscoveryOperationsContactMatchFields";
};
export type contactDiscoveryOperationsContactMatchFields$key = {
  readonly " $data"?: contactDiscoveryOperationsContactMatchFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"contactDiscoveryOperationsContactMatchFields">;
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
  "name": "contactDiscoveryOperationsContactMatchFields",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "contactName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inviteRecipient",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "matchedUsers",
      "plural": true,
      "selections": [
        (v0/*: any*/),
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
          "name": "privacyMode",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ContactMatch",
  "abstractKey": null
};
})();

(node as any).hash = "df30ee2cae16500663df2676359d98e2";

export default node;
