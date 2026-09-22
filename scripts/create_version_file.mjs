/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'node:fs';

const { version } = JSON.parse(
	fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const contents = `/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { semanticVersionString } from './types/version';

export const SDKVersion: semanticVersionString = '${version}';
`;
fs.writeFileSync(new URL('../src/version.ts', import.meta.url), contents);
