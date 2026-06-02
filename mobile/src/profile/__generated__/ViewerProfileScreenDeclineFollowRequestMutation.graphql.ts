/**
 * @generated SignedSource<<ff8169a6444367740cdb35a24ebf2697>>
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
export type ViewerProfileScreenDeclineFollowRequestMutation$variables = {
  input: DeclineFollowRequestInput;
};
export type ViewerProfileScreenDeclineFollowRequestMutation$data = {
  readonly declineFollowRequest: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type ViewerProfileScreenDeclineFollowRequestMutation = {
  response: ViewerProfileScreenDeclineFollowRequestMutation$data;
  variables: ViewerProfileScreenDeclineFollowRequestMutation$variables;
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
    "name": "ViewerProfileScreenDeclineFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileScreenDeclineFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "cdff090659f08134e7284fb1e31f7c26",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileScreenDeclineFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileScreenDeclineFollowRequestMutation(\n  $input: DeclineFollowRequestInput!\n) {\n  declineFollowRequest(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c79c1f5f0a62c854f1e1a5d8f7dd1c6e";

export default node;
