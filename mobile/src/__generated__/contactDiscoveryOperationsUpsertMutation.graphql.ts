/**
 * @generated SignedSource<<edd44df9a1e47bc37a67df989770e4dc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type UpsertViewerContactEntryInput = {
  birthday?: string | null | undefined;
  contactClientId: string;
  contactName?: string | null | undefined;
  emails?: ReadonlyArray<string> | null | undefined;
  phoneNumbers?: ReadonlyArray<string> | null | undefined;
};
export type contactDiscoveryOperationsUpsertMutation$variables = {
  input: UpsertViewerContactEntryInput;
};
export type contactDiscoveryOperationsUpsertMutation$data = {
  readonly upsertViewerContactEntry: {
    readonly contactMatch: {
      readonly contactName: string | null | undefined;
      readonly id: string;
      readonly matchedUsers: ReadonlyArray<{
        readonly email: string | null | undefined;
        readonly id: string;
        readonly privacyMode: UserPrivacyMode;
      }>;
    } | null | undefined;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type contactDiscoveryOperationsUpsertMutation = {
  response: contactDiscoveryOperationsUpsertMutation$data;
  variables: contactDiscoveryOperationsUpsertMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpsertViewerContactEntryPayload",
    "kind": "LinkedField",
    "name": "upsertViewerContactEntry",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ContactMatch",
        "kind": "LinkedField",
        "name": "contactMatch",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
              (v1/*: any*/),
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
    "name": "contactDiscoveryOperationsUpsertMutation",
    "selections": (v2/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "contactDiscoveryOperationsUpsertMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "09870cdbbcf38583647d970920970f7d",
    "id": null,
    "metadata": {},
    "name": "contactDiscoveryOperationsUpsertMutation",
    "operationKind": "mutation",
    "text": "mutation contactDiscoveryOperationsUpsertMutation(\n  $input: UpsertViewerContactEntryInput!\n) {\n  upsertViewerContactEntry(input: $input) {\n    contactMatch {\n      id\n      contactName\n      matchedUsers {\n        id\n        email\n        privacyMode\n      }\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3cee795b1806f01051c1f143a7de6c10";

export default node;
