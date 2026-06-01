/**
 * @generated SignedSource<<a32c995d538b38be0a7a648afda1b5f6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type UpdateViewerPrivacyModeInput = {
  privacyMode: UserPrivacyMode;
};
export type ViewerProfileScreenPrivacyModeMutation$variables = {
  input: UpdateViewerPrivacyModeInput;
};
export type ViewerProfileScreenPrivacyModeMutation$data = {
  readonly updateViewerPrivacyMode: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly user: {
      readonly id: string;
      readonly privacyMode: UserPrivacyMode;
    } | null | undefined;
  } | null | undefined;
};
export type ViewerProfileScreenPrivacyModeMutation = {
  response: ViewerProfileScreenPrivacyModeMutation$data;
  variables: ViewerProfileScreenPrivacyModeMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpdateViewerPrivacyModePayload",
    "kind": "LinkedField",
    "name": "updateViewerPrivacyMode",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "user",
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
            "name": "privacyMode",
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
    "name": "ViewerProfileScreenPrivacyModeMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileScreenPrivacyModeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "500bb763f9012c5110afa7c028447749",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenPrivacyModeMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileScreenPrivacyModeMutation(\n  $input: UpdateViewerPrivacyModeInput!\n) {\n  updateViewerPrivacyMode(input: $input) {\n    user {\n      id\n      privacyMode\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b063c7e615991709ae2e2d5ea8eaae31";

export default node;
