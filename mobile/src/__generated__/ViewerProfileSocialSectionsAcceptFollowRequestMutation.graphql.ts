/**
 * @generated SignedSource<<0165840fe2236ca6cbe54c919b91796e>>
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
export type ViewerProfileSocialSectionsAcceptFollowRequestMutation$variables = {
  input: AcceptFollowRequestInput;
};
export type ViewerProfileSocialSectionsAcceptFollowRequestMutation$data = {
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
export type ViewerProfileSocialSectionsAcceptFollowRequestMutation = {
  response: ViewerProfileSocialSectionsAcceptFollowRequestMutation$data;
  variables: ViewerProfileSocialSectionsAcceptFollowRequestMutation$variables;
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
    "name": "ViewerProfileSocialSectionsAcceptFollowRequestMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileSocialSectionsAcceptFollowRequestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8b4a4e25e988add666b7852b85e96b4b",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileSocialSectionsAcceptFollowRequestMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileSocialSectionsAcceptFollowRequestMutation(\n  $input: AcceptFollowRequestInput!\n) {\n  acceptFollowRequest(input: $input) {\n    follow {\n      id\n      state\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c799055e21f776dd759a0228aefa0f9e";

export default node;
