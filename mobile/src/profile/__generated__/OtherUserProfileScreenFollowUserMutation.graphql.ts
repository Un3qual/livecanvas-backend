/**
 * @generated SignedSource<<d83987c8dd46cdbc896978972a5c2b23>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type FollowState = "ACCEPTED" | "REQUESTED" | "%future added value";
export type FollowUserInput = {
  followedId: string;
};
export type OtherUserProfileScreenFollowUserMutation$variables = {
  input: FollowUserInput;
};
export type OtherUserProfileScreenFollowUserMutation$data = {
  readonly followUser: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly follow: {
      readonly id: string;
      readonly state: FollowState;
    } | null | undefined;
  } | null | undefined;
};
export type OtherUserProfileScreenFollowUserMutation = {
  response: OtherUserProfileScreenFollowUserMutation$data;
  variables: OtherUserProfileScreenFollowUserMutation$variables;
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
    "concreteType": "FollowUserPayload",
    "kind": "LinkedField",
    "name": "followUser",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SocialFollowPayload",
        "kind": "LinkedField",
        "name": "follow",
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
            "name": "state",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SocialError",
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
    "name": "OtherUserProfileScreenFollowUserMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "OtherUserProfileScreenFollowUserMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c89d528f04e772234bf881dbdbc63312",
    "id": null,
    "metadata": {},
    "name": "OtherUserProfileScreenFollowUserMutation",
    "operationKind": "mutation",
    "text": "mutation OtherUserProfileScreenFollowUserMutation(\n  $input: FollowUserInput!\n) {\n  followUser(input: $input) {\n    follow {\n      id\n      state\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cb84c947dde65b953e2026b2f72c6c3e";

export default node;
