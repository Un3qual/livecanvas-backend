/**
 * @generated SignedSource<<a79a3a8deab1bbd784ed3402f4b0d7d0>>
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
export type ViewerProfileSocialSectionsDeclineFollowRequestMutation$variables = {
  input: DeclineFollowRequestInput;
};
export type ViewerProfileSocialSectionsDeclineFollowRequestMutation$data = {
  readonly declineFollowRequest: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type ViewerProfileSocialSectionsDeclineFollowRequestMutation = {
  response: ViewerProfileSocialSectionsDeclineFollowRequestMutation$data;
  variables: ViewerProfileSocialSectionsDeclineFollowRequestMutation$variables;
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
    "name": "ViewerProfileSocialSectionsDeclineFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileSocialSectionsDeclineFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f031c42fe57b1922828989a7eef1743e",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileSocialSectionsDeclineFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileSocialSectionsDeclineFollowRequestMutation(\n  $input: DeclineFollowRequestInput!\n) {\n  declineFollowRequest(input: $input) {\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "48e5001341d5ac77c0becb1e4c751e97";

export default node;
