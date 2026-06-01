/**
 * @generated SignedSource<<581441210636ff6bf49c3f7b5d27cad8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LiveSessionStatus = "ENDED" | "LIVE" | "STARTING" | "%future added value";
export type LiveSessionVisibility = "FOLLOWERS" | "PUBLIC" | "%future added value";
export type LiveDiscoveryScreenQuery$variables = {
  first: number;
};
export type LiveDiscoveryScreenQuery$data = {
  readonly liveNow: {
    readonly edges: ReadonlyArray<{
      readonly node: {
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
      } | null | undefined;
    } | null | undefined> | null | undefined;
  } | null | undefined;
  readonly viewer: {
    readonly currentLiveSession: {
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
    } | null | undefined;
    readonly id: string;
  } | null | undefined;
};
export type LiveDiscoveryScreenQuery = {
  response: LiveDiscoveryScreenQuery$data;
  variables: LiveDiscoveryScreenQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
  (v1/*: any*/),
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
      (v1/*: any*/),
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
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      }
    ],
    "concreteType": "LiveSessionConnection",
    "kind": "LinkedField",
    "name": "liveNow",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSessionEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LiveSession",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": (v2/*: any*/),
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
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "LiveSession",
        "kind": "LinkedField",
        "name": "currentLiveSession",
        "plural": false,
        "selections": (v2/*: any*/),
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
    "name": "LiveDiscoveryScreenQuery",
    "selections": (v3/*: any*/),
    "type": "RootQueryType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LiveDiscoveryScreenQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "734352a88c66b098baa60708f76f82f8",
    "id": null,
    "metadata": {},
    "name": "LiveDiscoveryScreenQuery",
    "operationKind": "query",
    "text": "query LiveDiscoveryScreenQuery(\n  $first: Int!\n) {\n  liveNow(first: $first) {\n    edges {\n      node {\n        id\n        status\n        visibility\n        insertedAt\n        startedAt\n        endedAt\n        host {\n          id\n          email\n        }\n      }\n    }\n  }\n  viewer {\n    id\n    currentLiveSession {\n      id\n      status\n      visibility\n      insertedAt\n      startedAt\n      endedAt\n      host {\n        id\n        email\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f01fc14a1a5a5bfd5ebe0532710d7313";

export default node;
