/**
 * @generated SignedSource<<84bb4348fec9b2767caf015e4940ebd1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RemoveLiveChatMessageEventInput = {
  chatMessageEventId: string;
};
export type liveSessionChatControlOperationsRemoveMutation$variables = {
  input: RemoveLiveChatMessageEventInput;
};
export type liveSessionChatControlOperationsRemoveMutation$data = {
  readonly removeLiveChatMessageEvent: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly removedTimelineEventId: string | null | undefined;
  } | null | undefined;
};
export type liveSessionChatControlOperationsRemoveMutation = {
  response: liveSessionChatControlOperationsRemoveMutation$data;
  variables: liveSessionChatControlOperationsRemoveMutation$variables;
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
    "concreteType": "RemoveLiveChatMessageEventPayload",
    "kind": "LinkedField",
    "name": "removeLiveChatMessageEvent",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "removedTimelineEventId",
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
    "name": "liveSessionChatControlOperationsRemoveMutation",
    "selections": (v1/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionChatControlOperationsRemoveMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4fdd8b5a6f9847a3353ccad756fcc18e",
    "id": null,
    "metadata": {},
    "name": "liveSessionChatControlOperationsRemoveMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionChatControlOperationsRemoveMutation(\n  $input: RemoveLiveChatMessageEventInput!\n) {\n  removeLiveChatMessageEvent(input: $input) {\n    removedTimelineEventId\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4d4ad553c286e8e8f7cca81e93cf6358";

export default node;
