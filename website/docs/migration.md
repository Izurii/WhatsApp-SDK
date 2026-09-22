---
id: migration
title: Modernization and migration
---

# Modernization and migration

This guide covers changes from the original 0.0.5-Alpha SDK and how to migrate
existing applications.

## Runtime and installation

- Install the fork with `npm install whatsapp-sdk-js` or `yarn add whatsapp-sdk-js`,
  and change SDK imports from `whatsapp` to `whatsapp-sdk-js`.
- Use Node.js 22.22.2+; Node 24 LTS is recommended and selected by `.node-version`.
- Run `fnm use --install-if-missing`, `corepack enable`, then `yarn install --immutable`.
- For source installations, build with `yarn build`, create an archive with
  `npm pack`, and install that archive in your application.
- The SDK no longer loads `.env` asynchronously at import time. Use
  `node --env-file=.env app.js`, `process.loadEnvFile()`, or your application's
  environment loader before constructing the client. Production deployments
  should inject secrets.
- CommonJS `require('whatsapp-sdk-js')` and ESM default imports remain supported.
  Public message, webhook, and configuration types are available through
  `import type { InteractiveObject, WebhookObject } from 'whatsapp-sdk-js'`.
- ESM consumers receive a dedicated declaration entry matching the runtime
  default export. Public enums remain runtime objects and no longer emit
  ambient `const enum` declarations that fail under `isolatedModules`.

## API and type corrections

Choose `CLOUD_API_VERSION` explicitly. Examples use Graph API v26.0, but a
version string alone does not certify an integration. Review the official
[Graph API version schedule](https://developers.facebook.com/docs/graph-api/changelog/versions)
and [WhatsApp changelog](https://developers.facebook.com/docs/whatsapp/changelog)
for your account and use cases.

- Sender IDs and recipients accept strings. Environment-loaded sender IDs are
  now strings, avoiding silent precision loss. Existing positive safe-integer
  sender arguments remain supported; unsafe numeric IDs are rejected.
- Updating the sender ID or access token affects subsequent HTTP requests.
- Media, text, and location request fields are objects, not one-element tuples.
  Contacts and interactive sections are arrays. Contact phone fields accept real
  strings rather than the literal `PHONE_NUMBER`.
- Template media parameters are nested under `image`, `document`, or `video`.
  Date/time parameters use `date_time`; button parameters are arrays; language
  policy is optional. These corrections can require TypeScript caller changes.
- `messages.reaction()` sends `type: 'reaction'`; the previous enum incorrectly
  used `sticker`. An empty reaction emoji removes an existing reaction.
- `messages.interactive()` accepts CTA URL, Flow, and location-request payloads
  in addition to existing buttons, lists, and products.
- `messages.status()` accepts `typing_indicator: { type: 'text' }` and returns
  a `{ success: boolean }` response, not a message-send response.
- Webhook `metadata` is a single object with `phone_number_id`. Messages,
  contacts, errors, statuses, and conversations are optional when absent from
  an event. Interactive replies are discriminated by their string `type`.
  Pricing accepts both `CBP` and `PMP`; modern categories and failed status
  events are represented.

## Transport and webhook safety

Requests have an explicit deadline and reject with `code: 'ETIMEDOUT'` on
timeout. Interrupted or invalid response bodies reject rather than hang.
Repeated `responseBodyToJSON()` calls return the cached parse result. HTTP
error responses still resolve: callers must inspect `statusCode()` and the API
error body. A message-send HTTP 200 means acceptance, not delivery.

The webhook receiver requires an application secret and verification token.
It verifies signatures using a timing-safe comparison on raw bytes before
parsing JSON, limits bodies to 1 MB, and closes rejected requests explicitly.
Successful callbacks still own the response and must end it. The built-in
listener is HTTP; expose it through a properly configured HTTPS reverse proxy.

Access tokens, app secrets, message bodies, and verification URLs are no longer
logged by the SDK. Debug routing identifiers may still be sensitive.

`MAX_RETRIES_AFTER_WAIT` has been removed from configuration, types, and examples
because it never implemented retries. Remove references to the old property or
enum member from your application. A leftover environment variable is ignored.
Automatic retries of message sends can duplicate delivery.
Application-level persistence, deduplication, retries, and callback error
handling remain the application's responsibility.

## Tooling and verification

The toolchain uses TypeScript 6, Jest 30, ESLint 10 flat configuration, Prettier
3, and Docusaurus 3 with React 19. Babel stays on its maintained 7.x line because
`ts-jest` requires Babel below 8 and the current package build preserves the
legacy CommonJS export. TypeScript stays on 6.0 because the ESLint parser does
not yet support TypeScript 7. Node type definitions target the oldest supported
Node major rather than the newest non-LTS release.

Both dependency trees have committed Yarn 4 lockfiles and use Yarn 4.18.0 with
the `node-modules` linker. Version generation runs explicitly inside the build
script because Yarn 4 does not run arbitrary `prebuild` lifecycle hooks.
The docs lockfile
uses scoped patched `serialize-javascript` and `uuid` resolutions for upstream
Docusaurus dependencies; revisit these when the upstream ranges are fixed.
Run dependency audits regularly because new advisories may affect installed versions.

A versioned `patch-package` patch guards Docusaurus's code-wrapping hook against
detached elements during hydration or resizing. It is applied during website
installation and must be reviewed when upgrading Docusaurus.

Run `yarn test`, `yarn test:package`, the changelog/header checks, `yarn npm audit --all --recursive --no-deprecations`, and the
website build/audit before releasing. Formatting checks no longer modify files.
CI tests Node 22 and 24 on Linux, macOS, and Windows. Local tests use mocked
outbound requests and a real loopback HTTP webhook server. The package check
installs the packed SDK without development dependencies in a temporary
directory, verifies runtime imports, and compiles ESM and CommonJS TypeScript
consumers. It needs registry access and removes the temporary directory afterward.

The audit command checks security advisories for direct and transitive packages.
`--no-deprecations` separates deprecation notices from the security gate; it does
not exclude packages or ignore security advisories. The upstream test/build
toolchain still includes deprecated `glob` and `inflight` versions. Omit this
flag to include those maintenance warnings in the audit output.

## API coverage

The SDK supports messaging, phone number verification, two-step verification,
and webhook handling. Media upload/download,
business profile management, template management, Flow management and encrypted
data endpoints, Calling, account onboarding, and other new products are not
provided as dedicated APIs. Sending a Flow is supported, managing Flows is not.

Validate authentication, permissions, template approval, delivery, rate limits,
pricing, and webhook subscription against your Meta test account before
deploying an integration to production.