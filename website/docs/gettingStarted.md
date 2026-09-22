---
id: quickstart
title: Quickstart
slug: /
tags:
  - Getting started
---

# whatsapp-sdk-js Quickstart

This guide sends a text message using the Cloud API. To receive messages, see
[Receiving Messages](./receivingMessages.md). For changes from the original SDK,
read the [migration notes](./migration.md).

## Prerequisites
Before you begin:

1. Install [Node.js](https://nodejs.org/) 22.22.2 or later. Node 24 LTS is recommended.
2. Complete the steps in the [official docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#set-up-developer-assets) for getting started with the Cloud API. Stop once you've [sent a test message](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#sent-test-message).
3. Reply to the test message to open the 24-hour customer service window. Free-form messages require this window; outside it, use an approved template.

## Create
Open a new terminal window. Create a new directory for your project and then go to that directory.

```shell
mkdir wa_quickstart
cd ./wa_quickstart
```

Use the npm command to create a simple project definition file (package.json).

```shell
npm init --yes
```

Install the SDK:

```shell
npm install whatsapp-sdk-js
```

## Configure
Create a *.env* file in the root directory, add the values for the following variables, and save after you're done.
1. **WA_PHONE_NUMBER_ID** - Your phone number Id, located in the App Dashboard in the *WhatsApp* dropdown menu > *Getting started* > *Phone number ID*.
2. **CLOUD_API_ACCESS_TOKEN** - You can use the readily provided temporary access token or [system user access token](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started/#system-user-access-tokens) for this exercise. This is also located in the App Dashboard in the *WhatsApp* dropdown menu > *Getting started* > *Temporary access token*.
3. **CLOUD_API_VERSION** - Set this to the [latest version](https://developers.facebook.com/docs/graph-api/guides/versioning#latest) of the graph API.

The *.env* file should look like
```shell
# Your WhatsApp phone number Id (sender).
WA_PHONE_NUMBER_ID=

# System user access token. Recommended: Do not use a temporary access token.
CLOUD_API_ACCESS_TOKEN=

# Cloud API version number.
CLOUD_API_VERSION=v26.0
```

## Code
Create a CommonJS file named *start.js*. Set the recipient to your verified
test recipient's number as a string. The sender ID is read from the environment.
```js
const WhatsApp = require('whatsapp-sdk-js');
const wa = new WhatsApp();

async function main() {
    try {
        const response = await wa.messages.text({ body: 'Hello world' }, '15555550101');
        const body = await response.responseBodyToJSON();
        if (response.statusCode() >= 400) {
            throw new Error(`Cloud API returned HTTP ${response.statusCode()}`);
        }
        console.log(body.messages[0].id);
    } finally {
        wa.requester.client.clearSockets();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
```

## Anatomy
What the code above is doing is:
1. Creates the WhatsApp client using environment variables loaded before construction.
2. Sending a text type message with the text "Hello world" to the WhatsApp recipient.
3. Reads the response body and checks the HTTP status. HTTP API errors are returned as responses; transport errors reject the promise.
4. Logs the accepted message ID or a sanitized error, then closes idle sockets.

## Run
Run your application by putting in the following command into terminal:
```shell
node --env-file=.env start.js
```

:::note
A successful HTTP response means the message was accepted, not delivered. Use
status webhooks to track delivery, reads, or failures. Check the recipient,
customer service window, account restrictions, and webhook error details when
delivery fails. Do not automatically resend, as this can create duplicate messages.
:::
