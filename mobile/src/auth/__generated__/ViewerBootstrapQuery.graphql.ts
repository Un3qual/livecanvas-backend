/**
 * @generated SignedSource<<97add989994044dcb6e54c641d6906a5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type ViewerBootstrapQuery$variables = Record<PropertyKey, never>;
export type ViewerBootstrapQuery$data = {
  readonly viewer: {
    readonly email: string | null | undefined;
    readonly id: string;
    readonly insertedAt: string;
    readonly privacyMode: UserPrivacyMode;
  } | null | undefined;
};
export type ViewerBootstrapQuery = {
  response: ViewerBootstrapQuery$data;
  variables: ViewerBootstrapQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
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
        "name": "insertedAt",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerBootstrapQuery",
    "selections": (v0/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ViewerBootstrapQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "c816750b49aaaec371edd1074539adc6",
    "id": null,
    "metadata": {},
    "name": "ViewerBootstrapQuery",
    "operationKind": "query",
    "text": "query ViewerBootstrapQuery {\n  viewer {\n    id\n    email\n    privacyMode\n    insertedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "71dc342b6a144b81da9d2f179378d1e2";

export default node;
