# Contributing to whatsapp-sdk-js
We want to make contributing to this project as easy and transparent as
possible.

## Our Development Process
This fork is maintained independently by Izurii. Submit pull requests against
`main` in the [whatsapp-sdk-js repository](https://github.com/Izurii/WhatsApp-SDK).

## Pull Requests
We actively welcome your pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.

## Issues
We use [GitHub issues](https://github.com/Izurii/WhatsApp-SDK/issues) to track public bugs. Please ensure your description is
clear and has sufficient instructions to be able to reproduce the issue.

Do not include credentials, private user data, or sensitive vulnerability
details in public issues.

## Coding Style
* Tabs, not spaces.
* 80 character line length
* Spaces between special characters to improve readability.
* Follows the unofficial [Typescript styling guide](https://google.github.io/styleguide/tsguide.html#identifiers) except when not possible, for the name "WhatsApp," or other circumstances.

## Releases

Releases are triggered by pushing an annotated Git tag named `v<version>`.
The tag must match the version in `package.json`. The
[publishing workflow](.github/workflows/publish.yml) builds and verifies the
package before publishing the resulting archive. Prereleases use the npm
`next` tag; stable releases use `latest`.

### First npm publication

The package must exist on npm before its trusted publisher can be configured.
For the initial `0.1.0-alpha.0` publication, sign in to npm with a verified
account and complete two-factor authentication directly in your terminal:

```shell
npm login
yarn install --immutable
yarn test
yarn test:package
npm pack
npm publish ./whatsapp-sdk-js-0.1.0-alpha.0.tgz --access public --tag next
```

Inspect the files listed by `npm pack` before publishing. Keep the source and
package contents unchanged between this publication and its Git tag. The
workflow skips an existing version only when its registry integrity matches
the newly built archive exactly. Different contents require a new version.

### Trusted publishing setup

In the npm package's settings, add a GitHub Actions trusted publisher with:

- Owner: `Izurii`
- Repository: `WhatsApp-SDK`
- Workflow filename: `publish.yml`
- Environment: `npm`
- Allow direct publishing with `npm publish`.

Create the `npm` environment in the GitHub repository settings and configure
required reviewers and release-tag protections as appropriate. No npm token
secret is required. The GitHub repository must match `repository.url` in
`package.json`. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### Tagging a release

Update the package version and changelog, run the checks, and commit the release
changes. Push the commit before pushing its tag. For the initial release:

```shell
git push origin main
git tag -a v0.1.0-alpha.0 -m "whatsapp-sdk-js 0.1.0-alpha.0"
git push origin v0.1.0-alpha.0
```

For subsequent releases, use a new matching package version and tag. Do not
force-push or reuse release tags. Review the GitHub Actions run and approve
the `npm` environment deployment when prompted.

## License
By contributing to whatsapp-sdk-js, you agree that your contributions will be
licensed under the existing [project license](LICENSE).
