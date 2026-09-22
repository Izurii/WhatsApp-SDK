<!-- Copyright (c) Meta Platforms, Inc. and affiliates.
All rights reserved.

This source code is licensed under the license found in the
LICENSE file in the root directory of this source tree.
-->

# whatsapp-sdk-js

Node.js and TypeScript SDK for the WhatsApp Business Platform Cloud API.
<p align="center">
<img src="./website/static/img/wa_logo-216px.svg" width="216" alt="WhatsApp Logo" />
</p>

--------------------
## About

This project is an independently maintained fork of
[Meta's archived WhatsApp Node.js SDK](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK/issues/31).

Requires Node.js **22.22.2+**; Node 24 LTS is recommended. See the
[migration notes](website/docs/migration.md) for compatibility changes,
supported API features, and integration requirements.

--------------------

Welcome to SDK for the [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform/). This SDK is written for Node.js framework to simplify access to the [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/). The source code itself is written in Typescript with TypeScript declaration files to type-check usage of the WhatsApp Business Platform Node.js SDK in your code, along with hints and code completion in TypeScript compatible IDEs.

[![lint, prettify, spellcheck, test, and build](https://github.com/Izurii/WhatsApp-Js/actions/workflows/nodejs.ci.yml/badge.svg)](https://github.com/Izurii/WhatsApp-Js/blob/main/.github/workflows/nodejs.ci.yml)
[![generate docs](https://github.com/Izurii/WhatsApp-Js/actions/workflows/docusaurus.yml/badge.svg)](https://github.com/Izurii/WhatsApp-Js/blob/main/.github/workflows/docusaurus.yml)

## Getting started
View the [quick start documentation](https://izurii.github.io/WhatsApp-Js/) to learn how to use the SDK and get started.

## Installation

```shell
npm install whatsapp-sdk-js
```

Or with Yarn:

```shell
yarn add whatsapp-sdk-js
```

### From source
Build and package the SDK from the repository:

```shell
fnm use --install-if-missing
corepack enable
yarn install --immutable
yarn build
npm pack
```

Install the archive using the filename printed by `npm pack`:

```shell
npm install /path/to/sdk-package.tgz
```

## Configuration
The SDK reads environment variables when constructed. It does not load `.env`
files automatically. For local development, run `node --env-file=.env app.js`,
or load your environment explicitly before creating the client. Production
applications should inject secrets through their deployment environment.
Keep sender IDs and recipients as strings to avoid numeric precision loss.
Below are all the possible options; some are required only for webhooks.

Reading `.env` files is supported through Node itself. To load one in code
instead of using the CLI flag, do this before importing and constructing the SDK:

```js
require('node:process').loadEnvFile();
const WhatsApp = require('whatsapp-sdk-js');
const wa = new WhatsApp();
```

Loading belongs to the application so it chooses the file and timing, and the
SDK does not silently change environment variables used by other libraries.

```shell
# The base URL to send all SDK requests to (default graph.facebook.com).
# This variable should not be used unless necessary for development or special routing needs.
WA_BASE_URL=

# Your Meta for Developers app Id.
M4D_APP_ID=

# Your Meta for Developers Business app secret.
M4D_APP_SECRET=

# Your WhatsApp phone number Id (sender).
WA_PHONE_NUMBER_ID=

# Your WhatsApp business account Id.
WA_BUSINESS_ACCOUNT_ID=

# System user access token. Recommended: Do not use a temporary access token.
CLOUD_API_ACCESS_TOKEN=

# Cloud API version number.
CLOUD_API_VERSION=v26.0

# Customize your incoming webhook listener endpoint. Path should be
# https://{host}/{WEBHOOK_ENDPOINT}. A trailing slash is not added by default,
# so the variable should include that if it's required by your API gateway.
WEBHOOK_ENDPOINT=

# A custom verification token string to validate incoming webhook payloads.
# Needs to match webhook configuration.
WEBHOOK_VERIFICATION_TOKEN=

# Override the default app listener port (port 3000).
LISTENER_PORT=

# Turn on global debug logging
DEBUG=

# The timeout period in milliseconds for a request to wait for a response (default 20000ms)
REQUEST_TIMEOUT=
```

Pin a supported [Graph API version](https://developers.facebook.com/docs/graph-api/changelog/versions)
explicitly. The examples use v26.0; local tests do not establish live account
compatibility or replace Meta's version migration checks.

```js
const WhatsApp = require('whatsapp-sdk-js');
const wa = new WhatsApp();

async function main() {
	try {
		const response = await wa.messages.text(
			{ body: 'Hello world' },
			'15555550101',
		);
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

## Development

```shell
yarn test
yarn test:package
yarn check-changelog
yarn check-copyright-headers
yarn npm audit --all --recursive --no-deprecations
yarn --cwd website install --immutable
yarn --cwd website build
yarn --cwd website npm audit --all --recursive --no-deprecations
```

Both projects use Yarn 4.18.0 with the `node-modules` linker and separate lockfiles.
Formatting checks are read-only. Use `yarn prettier-format` to apply formatting.
CI covers Node 22 and 24 on Linux, macOS, and Windows; documentation is built
on every pull request. No live messages are sent by the test suite.

## Code of Conduct
Meta has adopted a Code of Conduct that we expect project participants to adhere to. Please read the full text so that you can understand what actions will and will not be tolerated.

## Contribute
See the [CONTRIBUTING](CONTRIBUTING.md) file for our development process, how to propose bugfixes and improvements, and how to build and test your changes to the WhatsApp Business Platform Node.js SDK.

## License
The WhatsApp Business Platform Node.js SDK for the Cloud API is Meta Platforms licensed, as found in the LICENSE file.
