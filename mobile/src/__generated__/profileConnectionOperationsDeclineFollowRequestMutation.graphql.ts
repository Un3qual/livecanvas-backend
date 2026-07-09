/**
 * @generated SignedSource<<47141aa17a667d3401d4b525361261ed>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeclineFollowRequestInput = {
  followerId: string;
};
export type profileConnectionOperationsDeclineFollowRequestMutation$variables = {
  input: DeclineFollowRequestInput;
};
export type profileConnectionOperationsDeclineFollowRequestMutation$data = {
  readonly declineFollowRequest: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type profileConnectionOperationsDeclineFollowRequestMutation = {
  response: profileConnectionOperationsDeclineFollowRequestMutation$data;
  variables: profileConnectionOperationsDeclineFollowRequestMutation$variables;
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
    "concreteType": "DeclineFollowRequestPayload",
    "kind": "LinkedField",
    "name": "declineFollowRequest",
    "plural": false,
    "selections": [
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
    "name": "profileConnectionOperationsDeclineFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "profileConnectionOperationsDeclineFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "316d7621544ab1d158d7eefeda13e82d",
    "id": null,
    "metadata": {},
    "name": "profileConnectionOperationsDeclineFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation profileConnectionOperationsDeclineFollowRequestMutation(\n  $input: DeclineFollowRequestInput!\n) {\n  declineFollowRequest(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "07dd0099e05ead97e5c7b6f9f45f759d";

export default node;
