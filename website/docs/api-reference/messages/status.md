---
id: status
title: .status
---

# WhatsApp.messages.status()
Mark a message as read, optionally displaying a typing indicator.

## Example:
Use the ID of an incoming message from a verified webhook. The typing indicator
is optional and automatically expires; it does not send a message.

```js
const response = await wa.messages.status({
	status: 'read',
	message_id: 'wamid.incoming-message-id',
	typing_indicator: { type: 'text' },
});
const result = await response.responseBodyToJSON();
console.log(response.statusCode(), result.success);
```

## Arguments
1. `body` : [StatusObject](../types/StatusObject) — the object describing the message status update.

## Returns
Promise of a response with `{ success: boolean }` on success. Check the HTTP
status before treating the result as successful. HTTP API errors are returned
as responses; network failures reject the promise.
