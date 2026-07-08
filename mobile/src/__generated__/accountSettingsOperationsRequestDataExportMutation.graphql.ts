/**
 * @generated SignedSource<<13e84ad954f92755bccc62ddf26d86ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DataExportRequestFormat = "JSON" | "%future added value";
export type DataExportRequestStatus = "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING" | "%future added value";
export type RequestViewerDataExportInput = {
  format?: DataExportRequestFormat | null | undefined;
};
export type accountSettingsOperationsRequestDataExportMutation$variables = {
  input: RequestViewerDataExportInput;
};
export type accountSettingsOperationsRequestDataExportMutation$data = {
  readonly requestViewerDataExport: {
    readonly dataExportRequest: {
      readonly completedAt: string | null | undefined;
      readonly failureReason: string | null | undefined;
      readonly format: DataExportRequestFormat;
      readonly id: string;
      readonly requestedAt: string;
      readonly status: DataExportRequestStatus;
    } | null | undefined;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type accountSettingsOperationsRequestDataExportMutation = {
  response: accountSettingsOperationsRequestDataExportMutation$data;
  variables: accountSettingsOperationsRequestDataExportMutation$variables;
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
    "concreteType": "RequestViewerDataExportPayload",
    "kind": "LinkedField",
    "name": "requestViewerDataExport",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DataExportRequest",
        "kind": "LinkedField",
        "name": "dataExportRequest",
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
            "name": "status",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "format",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "requestedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "completedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "failureReason",
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
    "name": "accountSettingsOperationsRequestDataExportMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "accountSettingsOperationsRequestDataExportMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6a7dee2182ea24eb8fc51ec0c1627beb",
    "id": null,
    "metadata": {},
    "name": "accountSettingsOperationsRequestDataExportMutation",
    "operationKind": "mutation",
    "text": "mutation accountSettingsOperationsRequestDataExportMutation(\n  $input: RequestViewerDataExportInput!\n) {\n  requestViewerDataExport(input: $input) {\n    dataExportRequest {\n      id\n      status\n      format\n      requestedAt\n      completedAt\n      failureReason\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "01a2e8112e922b4f3634877ccd46a96a";

export default node;
