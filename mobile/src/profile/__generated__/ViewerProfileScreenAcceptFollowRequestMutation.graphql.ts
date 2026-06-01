/**
 * @generated SignedSource<<54697fc5e0951aed6ba75a3964ab4d9d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type FollowState = "ACCEPTED" | "REQUESTED" | "%future added value";
export type AcceptFollowRequestInput = {
  followerId: string;
};
export type ViewerProfileScreenAcceptFollowRequestMutation$variables = {
  input: AcceptFollowRequestInput;
};
export type ViewerProfileScreenAcceptFollowRequestMutation$data = {
  readonly acceptFollowRequest: {
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
export type ViewerProfileScreenAcceptFollowRequestMutation = {
  response: ViewerProfileScreenAcceptFollowRequestMutation$data;
  variables: ViewerProfileScreenAcceptFollowRequestMutation$variables;
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
    "concreteType": "AcceptFollowRequestPayload",
    "kind": "LinkedField",
    "name": "acceptFollowRequest",
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
    "name": "ViewerProfileScreenAcceptFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileScreenAcceptFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4fedc95cdeb1b43b4362a2b915d59e46",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenAcceptFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileScreenAcceptFollowRequestMutation(\n  $input: AcceptFollowRequestInput!\n) {\n  acceptFollowRequest(input: $input) {\n    follow {\n      id\n      state\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "79a241fa739a27b5b9b03ea0aba40461";

export default node;
