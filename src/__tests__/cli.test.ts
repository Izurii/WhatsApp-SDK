/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console -- these tests assert on console output. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import nock from 'nock';
import { runCli } from '../cli';
import { generateXHub256Sig } from '../utils';
import { SDKVersion } from '../version';

const templatesPath = (after?: string) =>
	`/v26.0/9876543210/message_templates?fields=name%2Clanguage%2Ccategory%2Cstatus&limit=100${after ? `&after=${after}` : ''}`;

describe('command line', () => {
	const recipient = '15555550101';
	const originalEnv = { ...process.env };
	let directory: string;

	const writeFile = (name: string, contents: string) => {
		const file = path.join(directory, name);
		fs.writeFileSync(file, contents);
		return file;
	};
	const stderr = () =>
		jest
			.mocked(console.error)
			.mock.calls.map((call) => call.join(' '))
			.join('\n');

	beforeEach(() => {
		directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sdk-cli-'));
		process.env.WA_BASE_URL = 'example.com';
		process.env.WA_PHONE_NUMBER_ID = '1234567890';
		process.env.CLOUD_API_ACCESS_TOKEN = 'test-token';
		process.env.CLOUD_API_VERSION = 'v26.0';
		delete process.env.WA_BUSINESS_ACCOUNT_ID;
		nock.disableNetConnect();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		fs.rmSync(directory, { recursive: true, force: true });
		nock.cleanAll();
		nock.enableNetConnect();
		jest.restoreAllMocks();
		for (const key of Object.keys(process.env)) {
			if (!(key in originalEnv)) delete process.env[key];
		}
		Object.assign(process.env, originalEnv);
	});

	describe('help and version', () => {
		it('works without configuration', async () => {
			delete process.env.WA_PHONE_NUMBER_ID;
			delete process.env.CLOUD_API_ACCESS_TOKEN;
			expect(await runCli(['--help'])).toBe(0);
			expect(await runCli(['-v'])).toBe(0);
			expect(console.log).toHaveBeenLastCalledWith(SDKVersion);
		});

		it('shows command-specific help', async () => {
			expect(await runCli(['send', 'template', '--help'])).toBe(0);
			expect(console.log).toHaveBeenLastCalledWith(
				expect.stringContaining('--params-file <path>'),
			);
			expect(await runCli(['help', 'send', 'text'])).toBe(0);
			expect(console.log).toHaveBeenLastCalledWith(
				expect.stringContaining('--preview-url'),
			);
			expect(await runCli(['templates', '-h'])).toBe(0);
			expect(console.log).toHaveBeenLastCalledWith(
				expect.stringContaining('templates list'),
			);
		});

		it('prints usage and fails without a command', async () => {
			expect(await runCli([])).toBe(2);
			expect(stderr()).toContain('Commands:');
		});
	});

	describe('usage errors', () => {
		it.each([
			[['launch'], 'Unknown command "launch"'],
			[['send'], 'Missing subcommand for "send"'],
			[['send', 'audio', recipient], 'Unknown command "send audio"'],
			[['send', 'text', recipient], 'Missing arguments'],
			[['send', 'text', recipient, 'hello', 'world'], 'quote it'],
			[['send', 'text', 'not-a-number', 'hello'], '<recipient>'],
			[['send', 'text', recipient, '  '], '<message> must not be empty'],
			[['send', 'text', recipient, 'x'.repeat(4097)], 'at most 4096'],
			[
				['send', 'text', recipient, 'hi', '--bogus'],
				"Unknown option '--bogus'",
			],
			[
				['send', 'text', recipient, 'hi', '--image-url', 'https://a.b/c.png'],
				'--image-url is not supported by "send text"',
			],
			[['send', 'text', recipient, 'hi', '--from', 'abc'], '--from'],
			[['send', 'template', recipient, 'Hello', 'en_US'], '<name>'],
			[['send', 'template', recipient, 'hello', 'english'], '<language>'],
			[
				[
					'send',
					'template',
					recipient,
					'hello',
					'en',
					'--image-url',
					'http://example.org/a.png',
				],
				'--image-url must be a public HTTPS URL',
			],
			[
				[
					'send',
					'template',
					recipient,
					'hello',
					'en',
					'--image-url',
					'https://example.org/a.png',
					'--video-url',
					'https://example.org/a.mp4',
				],
				'Use only one header option',
			],
		])('rejects %j before sending', async (args, message) => {
			expect(await runCli(args)).toBe(2);
			expect(stderr()).toContain(message);
			expect(stderr()).toContain('--help" for usage');
		});

		it.each([
			['{"customer_name": ""}', 'must be a nonempty string'],
			['{"Customer": "Ana"}', 'parameter name "Customer"'],
			['[]', 'nonempty JSON object'],
			['"Ana"', 'nonempty JSON object'],
			['not json', 'as JSON'],
		])('rejects params file %s', async (contents, message) => {
			const file = writeFile('params.json', contents);
			expect(
				await runCli([
					'send',
					'template',
					recipient,
					'order_update',
					'en',
					'--params-file',
					file,
				]),
			).toBe(2);
			expect(stderr()).toContain(message);
		});
	});

	describe('configuration', () => {
		it('names missing variables', async () => {
			delete process.env.CLOUD_API_ACCESS_TOKEN;
			delete process.env.WA_PHONE_NUMBER_ID;
			expect(await runCli(['send', 'text', recipient, 'hi'])).toBe(1);
			expect(stderr()).toContain(
				'Missing CLOUD_API_ACCESS_TOKEN, WA_PHONE_NUMBER_ID.',
			);
		});

		it('requires the business account ID for templates', async () => {
			expect(await runCli(['templates', 'list'])).toBe(1);
			expect(stderr()).toContain('Missing WA_BUSINESS_ACCOUNT_ID');
			process.env.WA_BUSINESS_ACCOUNT_ID = 'abc';
			expect(await runCli(['templates', 'list'])).toBe(1);
			expect(stderr()).toContain(
				'WA_BUSINESS_ACCOUNT_ID must contain digits only',
			);
		});

		it('loads the default env file without overriding the environment', async () => {
			const envFile = writeFile(
				'.env',
				'WA_BUSINESS_ACCOUNT_ID=9876543210\nCLOUD_API_ACCESS_TOKEN=file-token\n',
			);
			const request = nock('https://example.com')
				.get(templatesPath())
				.matchHeader('Authorization', 'Bearer test-token')
				.reply(200, { data: [] });
			expect(await runCli(['templates', 'list'], envFile)).toBe(0);
			expect(request.isDone()).toBe(true);
		});

		it('ignores a missing default env file', async () => {
			process.env.WA_BUSINESS_ACCOUNT_ID = '9876543210';
			nock('https://example.com').get(templatesPath()).reply(200, { data: [] });
			expect(
				await runCli(['templates', 'list'], path.join(directory, '.env')),
			).toBe(0);
		});

		it('loads --env-file and fails when it does not exist', async () => {
			const envFile = writeFile(
				'prod.env',
				'WA_BUSINESS_ACCOUNT_ID=9876543210',
			);
			nock('https://example.com').get(templatesPath()).reply(200, { data: [] });
			expect(
				await runCli(['templates', 'list', '--env-file', envFile], 'unused'),
			).toBe(0);
			expect(
				await runCli([
					'templates',
					'list',
					`--env-file=${path.join(directory, 'missing.env')}`,
				]),
			).toBe(1);
			expect(stderr()).toContain('does not exist');
		});

		it('does not require WA_PHONE_NUMBER_ID to list templates', async () => {
			delete process.env.WA_PHONE_NUMBER_ID;
			process.env.WA_BUSINESS_ACCOUNT_ID = '9876543210';
			nock('https://example.com').get(templatesPath()).reply(200, { data: [] });
			expect(await runCli(['templates', 'list'])).toBe(0);
		});
	});

	describe('send text', () => {
		it('sends text and prints a summary', async () => {
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages', {
					messaging_product: 'whatsapp',
					recipient_type: 'individual',
					to: recipient,
					type: 'text',
					text: { body: 'Hello world' },
				})
				.reply(200, {
					contacts: [{ input: recipient, wa_id: recipient }],
					messages: [{ id: 'wamid.test', message_status: 'accepted' }],
				});

			expect(
				await runCli(['send', 'text', `+${recipient}`, 'Hello world']),
			).toBe(0);
			expect(request.isDone()).toBe(true);
			expect(console.log).toHaveBeenCalledWith(
				JSON.stringify({
					message_id: 'wamid.test',
					initial_status: 'accepted',
					delivery_confirmed: false,
				}),
			);
		});

		it('supports sender override, replies, link previews, and dash-prefixed text', async () => {
			const request = nock('https://example.com')
				.post('/v26.0/555/messages', {
					messaging_product: 'whatsapp',
					recipient_type: 'individual',
					to: recipient,
					type: 'text',
					text: {
						body: '-1 item left: https://example.org',
						preview_url: true,
					},
					context: { message_id: 'wamid.original' },
				})
				.reply(200, { messages: [{ id: 'wamid.test' }] });

			expect(
				await runCli([
					'send',
					'text',
					'--from',
					'555',
					'--reply-to=wamid.original',
					'--preview-url',
					recipient,
					'--',
					'-1 item left: https://example.org',
				]),
			).toBe(0);
			expect(request.isDone()).toBe(true);
		});

		it('reports API rejection codes without printing the response', async () => {
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages')
				.reply(400, {
					error: {
						code: 131047,
						error_subcode: 2494010,
						message: 'private details',
					},
				});

			expect(await runCli(['send', 'text', recipient, 'Hello world'])).toBe(1);
			expect(request.isDone()).toBe(true);
			expect(console.log).not.toHaveBeenCalled();
			expect(stderr()).toBe(
				'error: Cloud API returned HTTP 400, error code 131047, subcode 2494010.',
			);
		});

		it('prints the error body with --verbose', async () => {
			nock('https://example.com')
				.post('/v26.0/1234567890/messages')
				.reply(401, { error: { code: 190, message: 'token expired' } });

			expect(
				await runCli(['send', 'text', recipient, 'Hello world', '--verbose']),
			).toBe(1);
			expect(stderr()).toContain('token expired');
		});

		it('reports network errors', async () => {
			// With net connect disabled and no interceptor, nock fails the request.
			expect(await runCli(['send', 'text', recipient, 'Hello world'])).toBe(1);
			expect(stderr()).toMatch(/Network error \(E[A-Z]+\)/);
		});

		it('reports timeouts', async () => {
			process.env.REQUEST_TIMEOUT = '20';
			nock('https://example.com')
				.post('/v26.0/1234567890/messages')
				.delayConnection(200)
				.reply(200, { messages: [{ id: 'wamid.test' }] });

			expect(await runCli(['send', 'text', recipient, 'Hello world'])).toBe(1);
			expect(stderr()).toContain('Request timed out');
		});
	});

	describe('send template', () => {
		it('sends a template without parameters', async () => {
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages', {
					messaging_product: 'whatsapp',
					recipient_type: 'individual',
					to: recipient,
					type: 'template',
					template: { name: 'hello_world', language: { code: 'en_US' } },
				})
				.reply(200, {
					messages: [{ id: 'wamid.test', message_status: 'accepted' }],
				});

			expect(
				await runCli(['send', 'template', recipient, 'hello_world', 'en_US']),
			).toBe(0);
			expect(request.isDone()).toBe(true);
			expect(console.log).toHaveBeenCalledWith(
				JSON.stringify({
					message_id: 'wamid.test',
					initial_status: 'accepted',
					delivery_confirmed: false,
				}),
			);
		});

		it('sends a media header and named body parameters', async () => {
			const values = { customer_name: 'Test User', order_id: 42 };
			const paramsFile = writeFile('params.json', JSON.stringify(values));
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages', (body) => {
					expect(body.template).toEqual({
						name: 'order_update',
						language: { code: 'pt_BR' },
						components: [
							{
								type: 'header',
								parameters: [
									{
										type: 'image',
										image: { link: 'https://example.org/image.png' },
									},
								],
							},
							{
								type: 'body',
								parameters: [
									{
										type: 'text',
										parameter_name: 'customer_name',
										text: 'Test User',
									},
									{ type: 'text', parameter_name: 'order_id', text: '42' },
								],
							},
						],
					});
					return true;
				})
				.reply(200, { messages: [{ id: 'wamid.test' }] });

			expect(
				await runCli([
					'send',
					'template',
					recipient,
					'order_update',
					'pt_BR',
					'--image-url',
					'https://example.org/image.png',
					'--params-file',
					paramsFile,
				]),
			).toBe(0);
			expect(request.isDone()).toBe(true);
			expect(console.log).toHaveBeenCalledWith(
				JSON.stringify({
					message_id: 'wamid.test',
					initial_status: 'unknown',
					delivery_confirmed: false,
				}),
			);
		});

		it('sends a document header and positional body parameters', async () => {
			const paramsFile = writeFile('params.json', '["Ana", "#42"]');
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages', (body) => {
					expect(body.template.components).toEqual([
						{
							type: 'header',
							parameters: [
								{
									type: 'document',
									document: { link: 'https://example.org/invoice.pdf' },
								},
							],
						},
						{
							type: 'body',
							parameters: [
								{ type: 'text', text: 'Ana' },
								{ type: 'text', text: '#42' },
							],
						},
					]);
					return true;
				})
				.reply(200, { messages: [{ id: 'wamid.test' }] });

			expect(
				await runCli([
					'send',
					'template',
					recipient,
					'invoice',
					'en',
					'--document-url',
					'https://example.org/invoice.pdf',
					'--params-file',
					paramsFile,
				]),
			).toBe(0);
			expect(request.isDone()).toBe(true);
		});
	});

	describe('templates list', () => {
		beforeEach(() => {
			process.env.WA_BUSINESS_ACCOUNT_ID = '9876543210';
		});

		it('lists template metadata across pages', async () => {
			const first = nock('https://example.com')
				.get(templatesPath())
				.matchHeader('Authorization', 'Bearer test-token')
				.reply(200, {
					data: [
						{
							name: 'welcome',
							language: 'en_US',
							category: 'UTILITY',
							status: 'APPROVED',
							components: [{ text: 'private text' }],
						},
					],
					paging: {
						cursors: { after: 'page-2' },
						next: 'https://example.com/v26.0/9876543210/message_templates?after=page-2&access_token=private',
					},
				});
			const second = nock('https://example.com')
				.get(templatesPath('page-2'))
				.reply(200, {
					data: [
						{
							name: 'reminder',
							language: 'pt_BR',
							category: 'UTILITY',
							status: 'PAUSED',
						},
					],
				});

			expect(await runCli(['templates', 'list'])).toBe(0);
			expect(first.isDone()).toBe(true);
			expect(second.isDone()).toBe(true);
			expect(console.log).toHaveBeenCalledWith(
				JSON.stringify(
					[
						{
							name: 'welcome',
							language: 'en_US',
							category: 'UTILITY',
							status: 'APPROVED',
						},
						{
							name: 'reminder',
							language: 'pt_BR',
							category: 'UTILITY',
							status: 'PAUSED',
						},
					],
					null,
					2,
				),
			);
		});

		it('stops on a repeated page cursor', async () => {
			const page = {
				data: [],
				paging: {
					next: 'https://example.com/v26.0/9876543210/message_templates?after=same',
				},
			};
			nock('https://example.com').get(templatesPath()).reply(200, page);
			nock('https://example.com').get(templatesPath('same')).reply(200, page);

			expect(await runCli(['templates', 'list'])).toBe(1);
			expect(stderr()).toContain('invalid page cursor');
		});

		it('reports API errors without printing response data', async () => {
			const request = nock('https://example.com')
				.get(templatesPath())
				.reply(403, { error: { code: 200, message: 'private details' } });
			expect(await runCli(['templates', 'list'])).toBe(1);
			expect(request.isDone()).toBe(true);
			expect(console.log).not.toHaveBeenCalled();
			expect(stderr()).not.toContain('private details');
		});
	});

	describe('webhooks and status', () => {
		let store: string;
		let port: number;
		let controller: AbortController;

		const freePort = () =>
			new Promise<number>((resolve) => {
				const server = createServer().listen(0, () => {
					const { port } = server.address() as { port: number };
					server.close(() => resolve(port));
				});
			});
		const listening = async () => {
			for (let attempt = 0; attempt < 100; attempt++) {
				if (stderr().includes('Listening for webhooks')) return;
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			throw new Error('Webhook receiver did not start');
		};
		const webhook = (
			statuses: Record<string, unknown>[],
			secret = 'app-secret',
		) => {
			const body = JSON.stringify({
				object: 'whatsapp_business_account',
				entry: [
					{ id: '1', changes: [{ field: 'messages', value: { statuses } }] },
				],
			});
			return fetch(`http://127.0.0.1:${port}/webhook`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-hub-signature-256': `sha256=${generateXHub256Sig(body, secret)}`,
				},
				body,
			});
		};
		const status = (id: string, status: string, extra = {}) => ({
			id,
			status,
			timestamp: '1767225600',
			recipient_id: recipient,
			...extra,
		});
		const storedEvents = () =>
			fs
				.readFileSync(store, 'utf8')
				.trim()
				.split('\n')
				.map((line) => JSON.parse(line));

		beforeEach(async () => {
			nock.enableNetConnect('127.0.0.1');
			process.env.M4D_APP_SECRET = 'app-secret';
			process.env.WEBHOOK_VERIFICATION_TOKEN = 'verify-token';
			process.env.WEBHOOK_ENDPOINT = 'webhook';
			store = path.join(directory, 'statuses.jsonl');
			port = await freePort();
			controller = new AbortController();
		});

		afterEach(() => controller.abort());

		it('prints and records status events until interrupted', async () => {
			const run = runCli(
				['webhooks', 'listen', '--port', String(port), '--store', store],
				undefined,
				controller.signal,
			);
			await listening();

			const verification = await fetch(
				`http://127.0.0.1:${port}/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=abc`,
			);
			expect(await verification.text()).toBe('abc');
			expect(
				(await webhook([status('wamid.a', 'sent')], 'wrong-secret')).status,
			).toBe(401);
			expect(stderr()).toContain('rejected a webhook request (HTTP 401');
			expect(
				(
					await webhook([
						status('wamid.a', 'delivered'),
						status('wamid.b', 'failed', {
							errors: [
								{
									code: 131026,
									title: 'Message undeliverable',
									error_data: { details: 'private' },
								},
							],
						}),
					])
				).status,
			).toBe(200);

			controller.abort();
			expect(await run).toBe(0);
			const expected = [
				{
					message_id: 'wamid.a',
					status: 'delivered',
					timestamp: '2026-01-01T00:00:00.000Z',
				},
				{
					message_id: 'wamid.b',
					status: 'failed',
					timestamp: '2026-01-01T00:00:00.000Z',
					errors: [{ code: 131026, title: 'Message undeliverable' }],
				},
			];
			expect(storedEvents()).toEqual(expected);
			expect(jest.mocked(console.log).mock.calls).toEqual(
				expected.map((event) => [JSON.stringify(event)]),
			);
		});

		it('reports the latest recorded status', async () => {
			fs.writeFileSync(
				store,
				[
					{ message_id: 'wamid.a', status: 'read', timestamp: 't2' },
					{ message_id: 'wamid.b', status: 'sent', timestamp: 't0' },
					'not json',
					{ message_id: 'wamid.a', status: 'delivered', timestamp: 't1' },
				]
					.map((line) =>
						typeof line === 'string' ? line : JSON.stringify(line),
					)
					.join('\n'),
			);

			expect(await runCli(['status', 'get', 'wamid.a', '--store', store])).toBe(
				0,
			);
			expect(JSON.parse(jest.mocked(console.log).mock.calls[0][0])).toEqual({
				message_id: 'wamid.a',
				status: 'read',
				timestamp: 't2',
				history: [
					{ status: 'read', timestamp: 't2' },
					{ status: 'delivered', timestamp: 't1' },
				],
			});
			expect(await runCli(['status', 'get', 'wamid.c', '--store', store])).toBe(
				1,
			);
			expect(stderr()).toContain('No status recorded');
		});

		it('returns a recorded status without listening', async () => {
			fs.writeFileSync(
				store,
				JSON.stringify({
					message_id: 'wamid.a',
					status: 'read',
					timestamp: 't',
				}),
			);
			expect(
				await runCli(['status', 'wait', 'wamid.a', '--store', store]),
			).toBe(0);
			expect(stderr()).not.toContain('Listening');
		});

		it('waits until the message reaches the requested status', async () => {
			const run = runCli(
				[
					'status',
					'wait',
					'wamid.a',
					'--until',
					'read',
					'--port',
					String(port),
					'--store',
					store,
				],
				undefined,
				controller.signal,
			);
			await listening();
			await webhook([status('wamid.other', 'read'), status('wamid.a', 'sent')]);
			await webhook([status('wamid.a', 'delivered')]);
			await webhook([status('wamid.a', 'read')]);

			expect(await run).toBe(0);
			expect(console.log).toHaveBeenCalledWith(
				JSON.stringify({
					message_id: 'wamid.a',
					status: 'read',
					timestamp: '2026-01-01T00:00:00.000Z',
				}),
			);
			expect(storedEvents()).toHaveLength(4);
		});

		it('fails when the message fails', async () => {
			const run = runCli(
				['status', 'wait', 'wamid.a', '--port', String(port), '--store', store],
				undefined,
				controller.signal,
			);
			await listening();
			await webhook([
				status('wamid.a', 'failed', {
					errors: [{ code: 131049, title: 'Not delivered' }],
				}),
			]);

			expect(await run).toBe(1);
			expect(stderr()).toContain('The message failed with error code 131049.');
		});

		it('times out', async () => {
			expect(
				await runCli(
					[
						'status',
						'wait',
						'wamid.a',
						'--timeout',
						'0.05',
						'--port',
						String(port),
						'--store',
						store,
					],
					undefined,
					controller.signal,
				),
			).toBe(124);
			expect(stderr()).toContain('Timed out after 0.05s');
		});

		it('validates options and configuration', async () => {
			expect(
				await runCli(['status', 'wait', 'wamid.a', '--until', 'seen']),
			).toBe(2);
			expect(await runCli(['webhooks', 'listen', '--port', '0'])).toBe(2);
			expect(await runCli(['webhooks', 'listen', '--until', 'read'])).toBe(2);
			delete process.env.M4D_APP_SECRET;
			expect(await runCli(['webhooks', 'listen'])).toBe(1);
			expect(stderr()).toContain('Missing M4D_APP_SECRET');
		});
	});

	describe('template parameters and buttons', () => {
		const sendTemplate = (...extra: string[]) =>
			runCli(['send', 'template', recipient, 'order_update', 'en', ...extra]);
		const expectTemplate = (template: Record<string, unknown>) =>
			nock('https://example.com')
				.post('/v26.0/1234567890/messages', (body) => {
					expect(body.template).toEqual(template);
					return true;
				})
				.reply(200, { messages: [{ id: 'wamid.test' }] });

		it('sends header, body, and button parameters from sections and flags', async () => {
			const paramsFile = writeFile(
				'params.json',
				JSON.stringify({
					header: { customer_name: 'Ana' },
					body: ['42', 'tomorrow'],
					buttons: { 2: { coupon_code: 'SAVE10' }, 0: { url: 'orders/42' } },
				}),
			);
			const request = expectTemplate({
				name: 'order_update',
				language: { code: 'en' },
				components: [
					{
						type: 'header',
						parameters: [
							{ type: 'text', parameter_name: 'customer_name', text: 'Ana' },
						],
					},
					{
						type: 'body',
						parameters: [
							{ type: 'text', text: '42' },
							{ type: 'text', text: 'tomorrow' },
						],
					},
					{
						type: 'button',
						index: '0',
						sub_type: 'url',
						parameters: [{ type: 'text', text: 'orders/42' }],
					},
					{
						type: 'button',
						index: '1',
						sub_type: 'quick_reply',
						parameters: [{ type: 'payload', payload: 'stop=1' }],
					},
					{
						type: 'button',
						index: '2',
						sub_type: 'copy_code',
						parameters: [{ type: 'coupon_code', coupon_code: 'SAVE10' }],
					},
				],
			});

			expect(
				await sendTemplate(
					'--params-file',
					paramsFile,
					'--button-payload',
					'1=stop=1',
				),
			).toBe(0);
			expect(request.isDone()).toBe(true);
		});

		it('sends button parameters from flags alone', async () => {
			const request = expectTemplate({
				name: 'order_update',
				language: { code: 'en' },
				components: [
					{
						type: 'header',
						parameters: [
							{ type: 'image', image: { link: 'https://example.org/a.png' } },
						],
					},
					{
						type: 'button',
						index: '0',
						sub_type: 'url',
						parameters: [{ type: 'text', text: '546' }],
					},
				],
			});

			expect(
				await sendTemplate(
					'--image-url',
					'https://example.org/a.png',
					'--button-url',
					'0=546',
				),
			).toBe(0);
			expect(request.isDone()).toBe(true);
		});

		it.each([
			[{ footer: { a: 'b' } }, 'unknown section "footer"'],
			[
				{ buttons: ['546'] },
				'"buttons" must be an object keyed by button index',
			],
			[
				{ buttons: { 10: { url: 'a' } } },
				'button index must be a number from 0 to 9',
			],
			[
				{ buttons: { 0: { url: 'a', payload: 'b' } } },
				'must be an object with one of',
			],
			[{ buttons: { 0: { phone: 'a' } } }, 'must be an object with one of'],
			[
				{ buttons: { 0: { url: ' ' } } },
				'button 0 "url" must be a nonempty string',
			],
			[{ header: [], body: ['a'] }, 'nonempty JSON object'],
		])('rejects params file sections %j', async (contents, message) => {
			const file = writeFile('params.json', JSON.stringify(contents));
			expect(await sendTemplate('--params-file', file)).toBe(2);
			expect(stderr()).toContain(message);
		});

		it.each([
			[['--button-url', '546'], 'must look like <index>=<value>'],
			[['--button-url', 'a=546'], 'button index must be a number'],
			[['--button-url', '0='], 'must be a nonempty string'],
			[
				['--button-url', '0=a', '--button-payload', '0=b'],
				'Button 0 has more than one parameter',
			],
		])('rejects button flags %j', async (args, message) => {
			expect(await sendTemplate(...args)).toBe(2);
			expect(stderr()).toContain(message);
		});

		it('rejects media and text parameters in the same header', async () => {
			const file = writeFile(
				'params.json',
				JSON.stringify({ header: ['Ana'] }),
			);
			expect(
				await sendTemplate(
					'--params-file',
					file,
					'--image-url',
					'https://example.org/a.png',
				),
			).toBe(2);
			expect(stderr()).toContain('A header has either media or text');
		});
	});

	describe('templates get', () => {
		const getPath = (name: string) =>
			`/v26.0/9876543210/message_templates?fields=name%2Clanguage%2Cstatus%2Ccategory%2Cparameter_format%2Ccomponents&name=${name}&limit=100`;
		const named = {
			name: 'order_update',
			language: 'pt_BR',
			status: 'APPROVED',
			category: 'UTILITY',
			parameter_format: 'NAMED',
			components: [
				{ type: 'HEADER', format: 'IMAGE', example: { header_handle: ['x'] } },
				{
					type: 'BODY',
					text: 'Oi {{nome}}, pedido {{pedido}}. {{nome}}!',
					example: {
						body_text_named_params: [
							{ param_name: 'nome', example: 'Ana' },
							{ param_name: 'pedido', example: '42' },
						],
					},
				},
				{ type: 'FOOTER', text: 'Loja' },
				{
					type: 'BUTTONS',
					buttons: [
						{
							type: 'URL',
							text: 'Ver',
							url: 'https://example.org/orders?id={{1}}',
							example: ['https://example.org/orders?id=546'],
						},
						{ type: 'QUICK_REPLY', text: 'Parar' },
						{
							type: 'PHONE_NUMBER',
							text: 'Ligar',
							phone_number: '+5511999999999',
						},
						{ type: 'COPY_CODE', text: 'Copiar', example: 'SAVE10' },
					],
				},
			],
		};
		const positional = {
			name: 'order_update',
			language: 'en_US',
			status: 'APPROVED',
			category: 'MARKETING',
			parameter_format: 'POSITIONAL',
			components: [
				{
					type: 'HEADER',
					format: 'TEXT',
					text: 'Hi {{1}}',
					example: { header_text: ['Ana'] },
				},
				{
					type: 'BODY',
					text: 'Order {{1}} ships {{2}}',
					example: { body_text: [['42', 'today']] },
				},
			],
		};

		beforeEach(() => {
			process.env.WA_BUSINESS_ACCOUNT_ID = '9876543210';
		});

		it('describes variables, buttons, and a params file for each language', async () => {
			const request = nock('https://example.com')
				.get(getPath('order_update'))
				.reply(200, {
					data: [named, { ...positional, name: 'order_update_v2' }, positional],
				});

			expect(await runCli(['templates', 'get', 'order_update'])).toBe(0);
			expect(request.isDone()).toBe(true);
			expect(JSON.parse(jest.mocked(console.log).mock.calls[0][0])).toEqual([
				{
					name: 'order_update',
					language: 'pt_BR',
					status: 'APPROVED',
					category: 'UTILITY',
					parameter_format: 'NAMED',
					header: { format: 'IMAGE' },
					body: {
						text: 'Oi {{nome}}, pedido {{pedido}}. {{nome}}!',
						variables: [
							{ name: 'nome', example: 'Ana' },
							{ name: 'pedido', example: '42' },
						],
					},
					footer: 'Loja',
					buttons: [
						{
							index: 0,
							type: 'URL',
							text: 'Ver',
							url: 'https://example.org/orders?id={{1}}',
							parameter: { name: 'url', required: true, example: '546' },
						},
						{
							index: 1,
							type: 'QUICK_REPLY',
							text: 'Parar',
							parameter: { name: 'payload', required: false },
						},
						{
							index: 2,
							type: 'PHONE_NUMBER',
							text: 'Ligar',
							phone_number: '+5511999999999',
						},
						{
							index: 3,
							type: 'COPY_CODE',
							text: 'Copiar',
							parameter: {
								name: 'coupon_code',
								required: true,
								example: 'SAVE10',
							},
						},
					],
					params_file: {
						body: { nome: 'Ana', pedido: '42' },
						buttons: { 0: { url: '546' }, 3: { coupon_code: 'SAVE10' } },
					},
					send: 'whatsapp-sdk send template <recipient> order_update pt_BR --image-url <https-url> --params-file params.json',
				},
				{
					name: 'order_update',
					language: 'en_US',
					status: 'APPROVED',
					category: 'MARKETING',
					parameter_format: 'POSITIONAL',
					header: {
						format: 'TEXT',
						text: 'Hi {{1}}',
						variables: [{ name: '1', example: 'Ana' }],
					},
					body: {
						text: 'Order {{1}} ships {{2}}',
						variables: [
							{ name: '1', example: '42' },
							{ name: '2', example: 'today' },
						],
					},
					params_file: { header: ['Ana'], body: ['42', 'today'] },
					send: 'whatsapp-sdk send template <recipient> order_update en_US --params-file params.json',
				},
			]);
		});

		it('filters by language and reports missing templates', async () => {
			nock('https://example.com')
				.get(getPath('order_update'))
				.times(2)
				.reply(200, { data: [named, positional] });

			expect(
				await runCli([
					'templates',
					'get',
					'order_update',
					'--language',
					'en_US',
				]),
			).toBe(0);
			expect(
				JSON.parse(jest.mocked(console.log).mock.calls[0][0]).map(
					(template: { language: string }) => template.language,
				),
			).toEqual(['en_US']);
			expect(
				await runCli(['templates', 'get', 'order_update', '--language', 'es']),
			).toBe(1);
			expect(stderr()).toContain('Template "order_update" in es not found');
		});

		it('produces a params file that send template accepts', async () => {
			nock('https://example.com')
				.get(getPath('order_update'))
				.reply(200, { data: [named] });
			expect(await runCli(['templates', 'get', 'order_update'])).toBe(0);
			const [description] = JSON.parse(
				jest.mocked(console.log).mock.calls[0][0],
			);
			const file = writeFile(
				'params.json',
				JSON.stringify(description.params_file),
			);
			const request = nock('https://example.com')
				.post('/v26.0/1234567890/messages', (body) => {
					expect(body.template.components).toEqual([
						{
							type: 'header',
							parameters: [
								{ type: 'image', image: { link: 'https://example.org/a.png' } },
							],
						},
						{
							type: 'body',
							parameters: [
								{ type: 'text', parameter_name: 'nome', text: 'Ana' },
								{ type: 'text', parameter_name: 'pedido', text: '42' },
							],
						},
						{
							type: 'button',
							index: '0',
							sub_type: 'url',
							parameters: [{ type: 'text', text: '546' }],
						},
						{
							type: 'button',
							index: '3',
							sub_type: 'copy_code',
							parameters: [{ type: 'coupon_code', coupon_code: 'SAVE10' }],
						},
					]);
					return true;
				})
				.reply(200, { messages: [{ id: 'wamid.test' }] });

			expect(
				await runCli([
					'send',
					'template',
					recipient,
					'order_update',
					'pt_BR',
					'--image-url',
					'https://example.org/a.png',
					'--params-file',
					file,
				]),
			).toBe(0);
			expect(request.isDone()).toBe(true);
		});

		it('rejects invalid names before calling the API', async () => {
			expect(await runCli(['templates', 'get', 'Order Update'])).toBe(2);
			expect(stderr()).toContain('<name>');
		});
	});
});
