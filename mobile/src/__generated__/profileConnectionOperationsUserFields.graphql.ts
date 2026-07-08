/**
 * @generated SignedSource<<1c1548c359fb93d11d0b06639498b911>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type profileConnectionOperationsUserFields$data = {
  readonly email: string | null | undefined;
  readonly id: string;
  readonly privacyMode: UserPrivacyMode;
  readonly " $fragmentType": "profileConnectionOperationsUserFields";
};
export type profileConnectionOperationsUserFields$key = {
  readonly " $data"?: profileConnectionOperationsUserFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"profileConnectionOperationsUserFields">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "profileConnectionOperationsUserFields",
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
  "type": "User",
  "abstractKey": null
};

(node as any).hash = "f5db5ac40a955ba6a546a24f40e4da02";

export default node;
