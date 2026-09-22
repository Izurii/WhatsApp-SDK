/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as crypto from 'crypto';
import { WAConfigType } from './types/config';
import { WARequiredConfigEnum, WAConfigEnum } from './types/enums';
import Logger from './logger';

const LIB_NAME = 'UTILS';
const LOG_LOCAL = false;
const LOGGER = new Logger(LIB_NAME, process.env.DEBUG === 'true' || LOG_LOCAL);

const DEFAULT_BASE_URL = 'graph.facebook.com';
const DEFAULT_LISTENER_PORT = 3000;
const DEFAULT_REQUEST_TIMEOUT = 20000;

const emptyConfigChecker = (senderNumberId?: string | number) => {
	if (
		(process.env.WA_PHONE_NUMBER_ID === undefined ||
			process.env.WA_PHONE_NUMBER_ID === '') &&
		senderNumberId == undefined
	) {
		LOGGER.log(
			`Environmental variable: WA_PHONE_NUMBER_ID and/or sender phone number id arguement is undefined.`,
		);
		throw new Error('Missing WhatsApp sender phone number Id.');
	}

	for (const value of Object.values(WARequiredConfigEnum)) {
		if (
			process.env[`${value}`] === undefined ||
			process.env[`${value}`] === ''
		) {
			LOGGER.log(`Environmental variable: ${value} is undefined`);
			throw new Error('Invalid configuration.');
		}
	}
};

export const validatePhoneNumberId = (phoneNumberId: string | number) => {
	if (
		!/^\d+$/.test(String(phoneNumberId)) ||
		(typeof phoneNumberId === 'number' &&
			(!Number.isSafeInteger(phoneNumberId) || phoneNumberId <= 0))
	) {
		throw new Error(
			'Phone number ID must be a digit string or a positive safe integer',
		);
	}
};

export const importConfig = (senderNumberId?: string | number) => {
	emptyConfigChecker(senderNumberId);
	const phoneNumberId = senderNumberId ?? process.env.WA_PHONE_NUMBER_ID!;
	validatePhoneNumberId(phoneNumberId);

	const config: WAConfigType = {
		[WAConfigEnum.BaseURL]: process.env.WA_BASE_URL || DEFAULT_BASE_URL,
		[WAConfigEnum.AppId]: process.env.M4D_APP_ID || '',
		[WAConfigEnum.AppSecret]: process.env.M4D_APP_SECRET || '',
		[WAConfigEnum.PhoneNumberId]: phoneNumberId,
		[WAConfigEnum.BusinessAcctId]: process.env.WA_BUSINESS_ACCOUNT_ID || '',
		[WAConfigEnum.APIVersion]: process.env.CLOUD_API_VERSION || '',
		[WAConfigEnum.AccessToken]: process.env.CLOUD_API_ACCESS_TOKEN || '',
		[WAConfigEnum.WebhookEndpoint]: process.env.WEBHOOK_ENDPOINT || '',
		[WAConfigEnum.WebhookVerificationToken]:
			process.env.WEBHOOK_VERIFICATION_TOKEN || '',
		[WAConfigEnum.ListenerPort]:
			parseInt(process.env.LISTENER_PORT || '') || DEFAULT_LISTENER_PORT,
		[WAConfigEnum.RequestTimeout]:
			parseInt(process.env.REQUEST_TIMEOUT || '') || DEFAULT_REQUEST_TIMEOUT,
		[WAConfigEnum.Debug]: process.env.DEBUG === 'true',
	};

	LOGGER.log(`Configuration loaded for App Id ${config[WAConfigEnum.AppId]}`);

	return config;
};

export const generateXHub256Sig = (
	body: string | Buffer,
	appSecret: string,
) => {
	return crypto.createHmac('sha256', appSecret).update(body).digest('hex');
};
