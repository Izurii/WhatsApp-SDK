/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nock from 'nock';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { WAConfigType } from '../types/config';
import { HttpMethodsEnum } from '../types/enums';
import HttpsClient, { HttpsClientResponse } from '../httpsClient';

describe('HTTPS client tests', () => {
	const sdkConfig: WAConfigType = (global as any).sdkConfig;
	const basePath = `/${sdkConfig.CLOUD_API_VERSION}/${sdkConfig.WA_PHONE_NUMBER_ID}`;
	const reqHeaders = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${sdkConfig.CLOUD_API_ACCESS_TOKEN}`,
	};
	const client = new HttpsClient();
	let scope;

	afterEach(() => {
		nock.cleanAll();
	});

	afterAll(() => {
		client.clearSockets();
	});

	it('returns the same decoded body on repeated reads', async () => {
		const incoming = new IncomingMessage(new Socket());
		incoming.push(Buffer.from('{"success":true}'));
		incoming.push(null);
		const response = new HttpsClientResponse(incoming);
		expect(await response.responseBodyToJSON()).toEqual({ success: true });
		expect(await response.responseBodyToJSON()).toEqual({ success: true });
	});

	it('rejects interrupted response streams without hanging', async () => {
		const incoming = new IncomingMessage(new Socket());
		const response = new HttpsClientResponse(incoming);
		const body = response.responseBodyToJSON();
		incoming.destroy(new Error('Connection interrupted'));
		await expect(body).rejects.toThrow('Connection interrupted');
	});

	it('rejects malformed response JSON', async () => {
		const incoming = new IncomingMessage(new Socket());
		incoming.push(Buffer.from('invalid'));
		incoming.push(null);
		await expect(
			new HttpsClientResponse(incoming).responseBodyToJSON(),
		).rejects.toThrow(SyntaxError);
	});

	it('returns a recognizable request timeout', async () => {
		nock(`https://${sdkConfig.WA_BASE_URL}`)
			.get('/slow')
			.delayConnection(100)
			.reply(200, {});
		await expect(
			client.sendRequest(
				sdkConfig.WA_BASE_URL,
				443,
				'/slow',
				'GET',
				reqHeaders,
				10,
			),
		).rejects.toMatchObject({ code: 'ETIMEDOUT' });
	});

	it('allows POST requests without a body', async () => {
		const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post('/empty')
			.reply(200, {});
		const response = await client.sendRequest(
			sdkConfig.WA_BASE_URL,
			443,
			'/empty',
			'POST',
			reqHeaders,
			1000,
		);
		expect(await response.responseBodyToJSON()).toEqual({});
		expect(request.isDone()).toBe(true);
	});

	it('Send a POST request', async () => {
		scope = nock(`https://${sdkConfig.WA_BASE_URL}`, {
			reqheaders: {
				authorization: `Bearer ${sdkConfig.CLOUD_API_ACCESS_TOKEN}`,
			},
		})
			.post(/.*/)
			.delayConnection(100)
			.delay(200)
			.reply((uri, res_body) => {
				return [200, res_body];
			});
		const reqBody = { testKey: 'testValue' };

		const response = await client.sendRequest(
			sdkConfig.WA_BASE_URL,
			443,
			`${basePath}/test`,
			HttpMethodsEnum.Post,
			reqHeaders,
			sdkConfig.REQUEST_TIMEOUT,
			JSON.stringify(reqBody),
		);

		expect(response.statusCode()).toEqual(200);
		const respBody = await response.responseBodyToJSON();
		expect(respBody).toStrictEqual(reqBody);
		scope.isDone();
	});
});
