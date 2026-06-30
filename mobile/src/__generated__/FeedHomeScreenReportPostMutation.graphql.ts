/**
 * @generated SignedSource<<969b3630256f783af09aa80d50d33d52>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PostReportReason = "HARASSMENT" | "HATE" | "ILLEGAL" | "OTHER" | "SELF_HARM" | "SEXUAL_CONTENT" | "SPAM" | "VIOLENCE" | "%future added value";
export type PostReportStatus = "ACTIONED" | "DISMISSED" | "OPEN" | "REVIEWED" | "%future added value";
export type ReportPostInput = {
  details?: string | null | undefined;
  postId: string;
  reason: PostReportReason;
};
export type FeedHomeScreenReportPostMutation$variables = {
  input: ReportPostInput;
};
export type FeedHomeScreenReportPostMutation$data = {
  readonly reportPost: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly report: {
      readonly id: string;
      readonly insertedAt: string;
      readonly postId: string;
      readonly reason: PostReportReason;
      readonly status: PostReportStatus;
    } | null | undefined;
  } | null | undefined;
};
export type FeedHomeScreenReportPostMutation = {
  response: FeedHomeScreenReportPostMutation$data;
  variables: FeedHomeScreenReportPostMutation$variables;
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
    "concreteType": "ReportPostPayload",
    "kind": "LinkedField",
    "name": "reportPost",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PostReport",
        "kind": "LinkedField",
        "name": "report",
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
            "name": "postId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "reason",
            "storageKey": null
          },
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
            "name": "insertedAt",
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
    "name": "FeedHomeScreenReportPostMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "FeedHomeScreenReportPostMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fc5b5a1ea73de2a24ce40551992ad58d",
    "id": null,
    "metadata": {},
    "name": "FeedHomeScreenReportPostMutation",
    "operationKind": "mutation",
    "text": "mutation FeedHomeScreenReportPostMutation(\n  $input: ReportPostInput!\n) {\n  reportPost(input: $input) {\n    report {\n      id\n      postId\n      reason\n      status\n      insertedAt\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cb144f1064283a70a8a591335a51beac";

export default node;
