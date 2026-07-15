/**
 * @generated SignedSource<<1dcdefc8469e788fc5e658639ddf23df>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ImportViewerContactEntriesInput = {
  entries: ReadonlyArray<ViewerContactEntryInput>;
};
export type ViewerContactEntryInput = {
  birthday?: string | null | undefined;
  contactClientId: string;
  contactName?: string | null | undefined;
  emails?: ReadonlyArray<string> | null | undefined;
  phoneNumbers?: ReadonlyArray<string> | null | undefined;
};
export type contactDiscoveryOperationsImportMutation$variables = {
  input: ImportViewerContactEntriesInput;
};
export type contactDiscoveryOperationsImportMutation$data = {
  readonly importViewerContactEntries: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly importedCount: number;
  } | null | undefined;
};
export type contactDiscoveryOperationsImportMutation = {
  response: contactDiscoveryOperationsImportMutation$data;
  variables: contactDiscoveryOperationsImportMutation$variables;
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
    "concreteType": "ImportViewerContactEntriesPayload",
    "kind": "LinkedField",
    "name": "importViewerContactEntries",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "importedCount",
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
    "name": "contactDiscoveryOperationsImportMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "contactDiscoveryOperationsImportMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "2b7ee13a73c183780dbca19994c9d1ca",
    "id": null,
    "metadata": {},
    "name": "contactDiscoveryOperationsImportMutation",
    "operationKind": "mutation",
    "text": "mutation contactDiscoveryOperationsImportMutation(\n  $input: ImportViewerContactEntriesInput!\n) {\n  importViewerContactEntries(input: $input) {\n    importedCount\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2ff93832e4fc7a8298fb5d35ee8609c7";

export default node;
