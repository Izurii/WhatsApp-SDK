---
id: reaction
title: .reaction
---

# WhatsApp.messages.reaction()

React to an existing message using its ID. Pass an empty emoji to remove a
reaction. This does not send a sticker.

```js
await wa.messages.reaction({
	message_id: 'wamid.original-message-id',
	emoji: '\ud83d\udc4d',
}, '15555550101');
```

`wa` must be an initialized SDK client. Run the example inside an async
function or ESM module. The arguments are a `ReactionObject` and a recipient
string (preferred) or number. The returned response follows the usual
message-send contract; inspect the HTTP status and delivery webhooks.

Meta restricts which messages can receive reactions. See the current
[Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/reaction-messages)
for message age and other limitations.