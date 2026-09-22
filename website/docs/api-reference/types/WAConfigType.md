---
id: WAConfigType
title: WAConfigType
---

# SDK Configuration Type
This is the object that is used to configure each of the sub-classes of the SDK.

## Example
```json
{
    "WA_BASE_URL": "graph.facebook.com",
    "M4D_APP_ID": "12345",
    "M4D_APP_SECRET": "example_app_secret",
    "WA_PHONE_NUMBER_ID": "987654321",
    "WA_BUSINESS_ACCOUNT_ID": "1234567890",
    "CLOUD_API_VERSION": "v26.0",
    "CLOUD_API_ACCESS_TOKEN": "example_access_token",
    "WEBHOOK_ENDPOINT": "webhook",
    "WEBHOOK_VERIFICATION_TOKEN": "example_verification_token",
    "LISTENER_PORT": 3000,
    "REQUEST_TIMEOUT": 20000,
    "DEBUG": false
}
```

## Properties
The keys match `WAConfigEnum` and the environment variable names exactly.
IDs and credentials are strings; an explicit positive safe-integer sender ID
is also accepted. Ports and timeouts are numbers; `DEBUG` is a boolean.
`WA_BASE_URL` is a hostname, not a URL. Automatic retries are not implemented.
See the
[migration guide](../../migration.md) for behavior changes.
