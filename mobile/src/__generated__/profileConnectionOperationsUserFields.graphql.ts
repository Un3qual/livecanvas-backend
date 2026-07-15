/**
 * @generated SignedSource<<172907c63b9316a690e779ced307f904>>
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
  readonly displayName: string | null | undefined;
  readonly email: string | null | undefined;
  readonly id: string;
  readonly privacyMode: UserPrivacyMode;
  readonly username: string | null | undefined;
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
  "type": "User",
  "abstractKey": null
};

(node as any).hash = "d4e83ba43e988eb7bf805bde2ce2e5c4";

export default node;
