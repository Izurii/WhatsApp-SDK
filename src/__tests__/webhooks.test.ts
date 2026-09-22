import { request } from 'node:http';
import { once } from 'node:events';
import { AddressInfo, connect } from 'node:net';
import { jest } from '@jest/globals';
import WebhooksAPI from '../api/webhooks';
import Requester from '../requester';
import { WAConfigType } from '../types/config';
import { WebhookCallback, WebhookObject } from '../types/webhooks';
import { ConversationTypesEnum, StatusEnum } from '../types/enums';
import { generateXHub256Sig } from '../utils';

describe('Webhook receiver', () => {
	const config: WAConfigType = {
		...(global as any).sdkConfig,
		LISTENER_PORT: 0,
		WEBHOOK_ENDPOINT: '/webhook',
	};
	let webhooks: WebhooksAPI;
	let port: number;
	const callback = jest.fn<WebhookCallback>(
		(_status, _headers, _body, response) => {
			response?.end('ok');
		},
	);

	beforeEach(async () => {
		const requester = new Requester(
			'example.com',
			'v26.0',
			123,
			'token',
			'business',
			'test',
		);
		webhooks = new WebhooksAPI(config, requester, 'test');
		expect(webhooks.start(callback)).toBe(true);
		const server = webhooks.server!.server;
		await once(server, 'listening');
		port = (server.address() as AddressInfo).port;
	});

	afterEach(async () => {
		await new Promise<void>((resolve, reject) => {
			webhooks.stop((error) => (error ? reject(error) : resolve()));
		});
		expect(webhooks.isStarted()).toBe(false);
	});

	const send = (
		method: string,
		path = '/webhook',
		chunks: Buffer[] = [],
		signature?: string,
	) =>
		new Promise<{ status: number; body: string }>((resolve, reject) => {
			const req = request(
				{
					hostname: '127.0.0.1',
					port,
					method,
					path,
					headers: signature ? { 'x-hub-signature-256': signature } : {},
				},
				(response) => {
					let body = '';
					response.setEncoding('utf8');
					response.on('data', (chunk) => {
						body += chunk;
					});
					response.on('end', () =>
						resolve({ status: response.statusCode!, body }),
					);
					response.on('error', reject);
				},
			);
			req.on('error', reject);
			req.setTimeout(2000, () =>
				req.destroy(new Error('Test request timed out')),
			);
			for (const chunk of chunks) req.write(chunk);
			req.end();
		});

	it('verifies subscriptions and rejects missing challenges', async () => {
		const query =
			'?hub.mode=subscribe&hub.verify_token=TEST_WEBHOOK_VERIFICATION_TOKEN';
		expect(await send('GET', `/webhook${query}&hub.challenge=123`)).toEqual({
			status: 200,
			body: '123',
		});
		expect((await send('GET', `/webhook${query}`)).status).toBe(401);
	});

	it('verifies raw multi-byte chunked payloads before delivering them', async () => {
		const payload = {
			object: 'whatsapp_business_account',
			entry: [],
			text: '\u00e9',
		};
		const body = Buffer.from(JSON.stringify(payload));
		const split = body.indexOf(Buffer.from('\u00e9')) + 1;
		const signature = `sha256=${generateXHub256Sig(body, config.M4D_APP_SECRET)}`;
		expect(
			await send(
				'POST',
				'/webhook',
				[body.subarray(0, split), body.subarray(split)],
				signature,
			),
		).toEqual({ status: 200, body: 'ok' });
		expect(callback).toHaveBeenCalledWith(
			200,
			expect.any(Object),
			payload,
			expect.any(Object),
			undefined,
		);
	});

	it.each([undefined, 'sha256=bad', `sha256=${'0'.repeat(64)}`])(
		'rejects invalid signatures: %s',
		async (signature) => {
			expect(
				(await send('POST', '/webhook', [Buffer.from('not-json')], signature))
					.status,
			).toBe(401);
			expect(callback).toHaveBeenCalledWith(
				401,
				expect.any(Object),
				undefined,
				undefined,
				expect.any(Error),
			);
		},
	);

	it('rejects malformed JSON only after authentication', async () => {
		const body = Buffer.from('not-json');
		const signature = `sha256=${generateXHub256Sig(body, config.M4D_APP_SECRET)}`;
		expect((await send('POST', '/webhook', [body], signature)).status).toBe(
			400,
		);
	});

	it('accepts current status webhooks with per-message pricing', async () => {
		const payload: WebhookObject = {
			object: 'whatsapp_business_account',
			entry: [
				{
					id: 'business',
					changes: [
						{
							field: 'messages',
							value: {
								messaging_product: 'whatsapp',
								metadata: {
									display_phone_number: '15555550100',
									phone_number_id: '123',
								},
								statuses: [
									{
										id: 'wamid.sent',
										recipient_id: '15555550101',
										timestamp: '1750000000',
										status: StatusEnum.Delivered,
										pricing: {
											pricing_model: 'PMP',
											category: ConversationTypesEnum.Utility,
											billable: true,
											type: 'regular',
										},
									},
								],
							},
						},
					],
				},
			],
		};
		const body = Buffer.from(JSON.stringify(payload));
		const signature = `sha256=${generateXHub256Sig(body, config.M4D_APP_SECRET)}`;
		expect((await send('POST', '/webhook', [body], signature)).status).toBe(
			200,
		);
		expect(callback).toHaveBeenCalledWith(
			200,
			expect.any(Object),
			payload,
			expect.any(Object),
			undefined,
		);
	});

	it('rejects oversized bodies', async () => {
		const body = Buffer.alloc(1_000_001, 'x');
		const signature = `sha256=${generateXHub256Sig(body, config.M4D_APP_SECRET)}`;
		expect((await send('POST', '/webhook', [body], signature)).status).toBe(
			413,
		);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('finishes requests for unsupported paths and methods', async () => {
		expect((await send('GET', '/missing')).status).toBe(404);
		expect((await send('PUT')).status).toBe(405);
	});

	it('rejects malformed request URLs without crashing the server', async () => {
		const response = await new Promise<string>((resolve, reject) => {
			const socket = connect(port, '127.0.0.1', () => {
				socket.write(
					'GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',
				);
			});
			let body = '';
			socket.setEncoding('utf8');
			socket.on('data', (chunk) => {
				body += chunk;
			});
			socket.on('end', () => resolve(body));
			socket.on('error', reject);
			socket.setTimeout(2000, () =>
				socket.destroy(new Error('Test socket timed out')),
			);
		});
		expect(response).toMatch(/^HTTP\/1\.1 400/);
		expect(webhooks.isStarted()).toBe(true);
	});

	it('rejects duplicate starts and missing secrets', () => {
		expect(() => webhooks.start(callback)).toThrow('Server already started');
		const invalid = new WebhooksAPI(
			{ ...config, M4D_APP_SECRET: '' },
			{} as Requester,
			'test',
		);
		expect(() => invalid.start(callback)).toThrow('Webhook app secret');
	});
});
