/**
 * @generated SignedSource<<36767d3407999971c76f8b349e72cb70>>
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
export type profileConnectionOperationsAcceptFollowRequestMutation$variables = {
  input: AcceptFollowRequestInput;
};
export type profileConnectionOperationsAcceptFollowRequestMutation$data = {
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
export type profileConnectionOperationsAcceptFollowRequestMutation = {
  response: profileConnectionOperationsAcceptFollowRequestMutation$data;
  variables: profileConnectionOperationsAcceptFollowRequestMutation$variables;
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
    "name": "profileConnectionOperationsAcceptFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "profileConnectionOperationsAcceptFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3a9ce3fcc7786b551e21c483bdb6c10a",
    "id": null,
    "metadata": {},
    "name": "profileConnectionOperationsAcceptFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation profileConnectionOperationsAcceptFollowRequestMutation(\n  $input: AcceptFollowRequestInput!\n) {\n  acceptFollowRequest(input: $input) {\n    follow {\n      id\n      state\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a19b4fc4ffea984fa8580fa35c56572e";

export default node;
