/**
 * @generated SignedSource<<399b4c1b8ff3635a198d2d5ce45cb414>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditLiveChatMessageInput = {
  body: string;
  chatMessageEventId: string;
};
export type liveSessionChatControlOperationsEditMutation$variables = {
  input: EditLiveChatMessageInput;
};
export type liveSessionChatControlOperationsEditMutation$data = {
  readonly editLiveChatMessage: {
    readonly chatMessageEvent: {
      readonly actor: {
        readonly id: string;
      } | null | undefined;
      readonly body: string;
      readonly editCount: number;
      readonly edited: boolean;
      readonly editedAt: string | null | undefined;
      readonly id: string;
    } | null | undefined;
    readonly errors: ReadonlyArray<{
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
  } | null | undefined;
};
export type liveSessionChatControlOperationsEditMutation = {
  response: liveSessionChatControlOperationsEditMutation$data;
  variables: liveSessionChatControlOperationsEditMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EditLiveChatMessagePayload",
    "kind": "LinkedField",
    "name": "editLiveChatMessage",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ChatMessageEvent",
        "kind": "LinkedField",
        "name": "chatMessageEvent",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "body",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "edited",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "editCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "editedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "actor",
            "plural": false,
            "selections": [
              (v1/*: any*/)
            ],
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
    "name": "liveSessionChatControlOperationsEditMutation",
    "selections": (v2/*: any*/),
    "type": "RootMutationType",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "liveSessionChatControlOperationsEditMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "06b08845674d95a531d2b14e9121eadf",
    "id": null,
    "metadata": {},
    "name": "liveSessionChatControlOperationsEditMutation",
    "operationKind": "mutation",
    "text": "mutation liveSessionChatControlOperationsEditMutation(\n  $input: EditLiveChatMessageInput!\n) {\n  editLiveChatMessage(input: $input) {\n    chatMessageEvent {\n      id\n      body\n      edited\n      editCount\n      editedAt\n      actor {\n        id\n      }\n    }\n    errors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b5952d6857a894e07e04b3d6511e9e5a";

export default node;
