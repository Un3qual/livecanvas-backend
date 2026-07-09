/**
 * @generated SignedSource<<0f228db63ef50d6662c6e36c6a64feca>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserPrivacyMode = "PRIVATE" | "PUBLIC" | "%future added value";
export type contactDiscoveryOperationsQuery$variables = {
  after?: string | null | undefined;
  first: number;
};
export type contactDiscoveryOperationsQuery$data = {
  readonly viewerContactMatches: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly contactName: string | null | undefined;
        readonly id: string;
        readonly inviteRecipient: string | null | undefined;
        readonly matchedUsers: ReadonlyArray<{
          readonly email: string | null | undefined;
          readonly id: string;
          readonly privacyMode: UserPrivacyMode;
        }>;
      } | null | undefined;
    } | null | undefined> | null | undefined;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  } | null | undefined;
};
export type contactDiscoveryOperationsQuery = {
  response: contactDiscoveryOperationsQuery$data;
  variables: contactDiscoveryOperationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
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
        "name": "after",
        "variableName": "after"
      },
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      }
    ],
    "concreteType": "ContactMatchConnection",
    "kind": "LinkedField",
    "name": "viewerContactMatches",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ContactMatchEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ContactMatch",
            "kind": "LinkedField",
            "name": "node",
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
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "PageInfo",
        "kind": "LinkedField",
        "name": "pageInfo",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endCursor",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hasNextPage",
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
    "name": "contactDiscoveryOperationsQuery",
    "selections": (v2/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "contactDiscoveryOperationsQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "fee626e2645c3a3df301a28cd6fef22d",
    "id": null,
    "metadata": {},
    "name": "contactDiscoveryOperationsQuery",
    "operationKind": "query",
    "text": "query contactDiscoveryOperationsQuery(\n  $after: String\n  $first: Int!\n) {\n  viewerContactMatches(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        contactName\n        inviteRecipient\n        matchedUsers {\n          id\n          email\n          privacyMode\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9ed5622bfe44dd424c550cbfc1a46c35";

export default node;
