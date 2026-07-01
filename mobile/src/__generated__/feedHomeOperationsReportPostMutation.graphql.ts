/**
 * @generated SignedSource<<75ab9348bf928490dfd1ac30de18b653>>
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
export type feedHomeOperationsReportPostMutation$variables = {
  input: ReportPostInput;
};
export type feedHomeOperationsReportPostMutation$data = {
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
export type feedHomeOperationsReportPostMutation = {
  response: feedHomeOperationsReportPostMutation$data;
  variables: feedHomeOperationsReportPostMutation$variables;
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
    "name": "feedHomeOperationsReportPostMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "feedHomeOperationsReportPostMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "95d512298acf3b69ca2e6bd0ddd024b3",
    "id": null,
    "metadata": {},
    "name": "feedHomeOperationsReportPostMutation",
    "operationKind": "mutation",
    "text": "mutation feedHomeOperationsReportPostMutation(\n  $input: ReportPostInput!\n) {\n  reportPost(input: $input) {\n    report {\n      id\n      postId\n      reason\n      status\n      insertedAt\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "00cedd21b9bb5ae5cf1056b89323a5ba";

export default node;
