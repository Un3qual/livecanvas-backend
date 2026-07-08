/**
 * @generated SignedSource<<498d5a27a78ff11e94b6caa0eb7eaa28>>
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

(node as any).hash = "07898c9c1658bec06307f47868ac4a3c";

export default node;
