---
id: projectSetup
title: Project setup
---

# Set up your Node.js Project
Learn the basics for setting up the WhatsApp Business Platform SDK for your Node.js project and important details about the SDK.

## Start a new project
If you new to using the WhatsApp Business Platform Node.js SDK, first follow the provided [quickstart](/) for steps to send your first message and perform basic project setup and configuration.

### Installation

```shell
npm install whatsapp-sdk-js
```

:::note
This SDK requires server-side Node.js 22.22.2+ and does not support browsers.
:::

### Development
Load configuration before constructing the SDK. For local development, run
`node --env-file=.env app.js`. The SDK never loads `.env` implicitly. The logger
can be enabled by setting **DEBUG** to `true` before importing the SDK.

Alternatively, use Node's synchronous loader before importing the SDK:

```js
require('node:process').loadEnvFile();
const WhatsApp = require('whatsapp-sdk-js');
const wa = new WhatsApp();
```

The application chooses which file to load. The SDK does not asynchronously
load a file or mutate shared process configuration as an import side effect.

:::warning
Debug output includes routing identifiers. Treat logs as sensitive. The SDK
does not log access tokens, app secrets, message bodies, or webhook verification URLs.
:::

### Production
Inject environment variables through your deployment's secret management.
Keep credentials out of source control. Configure a supported Graph API version
explicitly, pass IDs as strings, and inspect HTTP status codes and webhook
delivery statuses. Automatic retries are not implemented; retrying sends can
duplicate delivery.

:::info

### TypeScript support
The WhatsApp Business Platform Node.js SDK supports TypeScript with TypeScript declaration files for WhatsApp Business Platform APIs. These files help you type-check usage of the WhatsApp Business Platform Node.js SDK in your code, along with hints and code completion in TypeScript compatible IDEs.
:::
