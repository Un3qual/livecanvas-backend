/**
 * @generated SignedSource<<50e4d31b70f05f01bd11934329017b70>>
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
    readonly displayName: string | null | undefined;
    readonly email: string | null | undefined;
    readonly id: string;
    readonly privacyMode: UserPrivacyMode;
    readonly username: string | null | undefined;
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
          "name": "privacyMode",
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
  "type": "ContactMatch",
  "abstractKey": null
};
})();

(node as any).hash = "8d0d29e12e099c0b4411776057e73a6c";

export default node;
