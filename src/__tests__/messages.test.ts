/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import nock from 'nock';
import { WAConfigType } from '../types/config';
import MessagesAPI from '../api/messages';
import WhatsApp from '../WhatsApp';
import {
	ComponentTypesEnum,
	ButtonTypesEnum,
	InteractiveTypesEnum,
	ParametersTypesEnum,
} from '../types/enums';
import {
	ContactObject,
	InteractiveObject,
	MessageTemplateObject,
} from '../types/messages';

describe('WhatsApp Messages API', () => {
	const testRecipient = 1234;
	const sdkConfig: WAConfigType = (global as any).sdkConfig;
	process.env.WA_BASE_URL = sdkConfig.WA_BASE_URL;
	process.env.M4D_APP_ID = sdkConfig.M4D_APP_ID;
	process.env.M4D_APP_SECRET = sdkConfig.M4D_APP_SECRET;
	process.env.WA_PHONE_NUMBER_ID = sdkConfig.WA_PHONE_NUMBER_ID.toString();
	process.env.WA_BUSINESS_ACCOUNT_ID = sdkConfig.WA_BUSINESS_ACCOUNT_ID;
	process.env.CLOUD_API_ACCESS_TOKEN = sdkConfig.CLOUD_API_ACCESS_TOKEN;
	process.env.CLOUD_API_VERSION = sdkConfig.CLOUD_API_VERSION;
	process.env.WEBHOOK_ENDPOINT = sdkConfig.WEBHOOK_ENDPOINT;
	process.env.WEBHOOK_VERIFICATION_TOKEN = sdkConfig.WEBHOOK_VERIFICATION_TOKEN;
	process.env.LISTENER_PORT = sdkConfig.LISTENER_PORT.toString();
	process.env.DEBUG = sdkConfig.DEBUG.toString();
	process.env.REQUEST_TIMEOUT = sdkConfig.REQUEST_TIMEOUT.toString();

	const wa = new WhatsApp();
	const basePath = `/${sdkConfig.CLOUD_API_VERSION}/${sdkConfig.WA_PHONE_NUMBER_ID}`;
	const defaultMessagesResponseBody = {
		messaging_product: 'whatsapp',
		contacts: [{ input: '16505076520', wa_id: '16505076520' }],
		messages: [
			{
				id: 'wamid.HBgLMTY1MDUwNzY1MjAVAgARGBI5QTNDQTVCM0Q0Q0Q2RTY3RTcA',
			},
		],
	};

	let scope;

	afterAll(() => {
		wa.requester.client.clearSockets();
	});

	afterEach(() => {
		nock.cleanAll();
		nock.restore();
		nock.activate();
	});

	it('messages class instance', () => {
		expect(wa.messages).toBeInstanceOf(MessagesAPI);
	});

	it('sends reactions rather than stickers and preserves string recipients', async () => {
		const reaction = { message_id: 'wamid.original', emoji: '\ud83d\udc4d' };
		const recipient = '9007199254740993';
		const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`, {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: recipient,
				type: 'reaction',
				reaction,
			})
			.reply(200, defaultMessagesResponseBody);
		await wa.messages.reaction(reaction, recipient);
		expect(request.isDone()).toBe(true);
	});

	it('sends multiple contacts and contextual replies', async () => {
		const contacts: ContactObject[] = [
			{
				name: { formatted_name: 'First' },
				phones: [{ phone: '+15555550101' }],
			},
			{ name: { formatted_name: 'Second' } },
		];
		const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`, {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: '1234',
				type: 'contacts',
				contacts,
				context: { message_id: 'original' },
			})
			.reply(200, defaultMessagesResponseBody);
		await wa.messages.contacts(contacts, testRecipient, 'original');
		expect(request.isDone()).toBe(true);
	});

	it('sends typed template media and button parameter arrays', async () => {
		const template: MessageTemplateObject = {
			name: 'receipt',
			language: { code: 'en_US' },
			components: [
				{
					type: ComponentTypesEnum.Header,
					parameters: [
						{ type: ParametersTypesEnum.Image, image: { id: 'media-id' } },
					],
				},
				{
					type: ComponentTypesEnum.Body,
					parameters: [
						{
							type: ParametersTypesEnum.DateTime,
							date_time: { fallback_value: 'Today' },
						},
					],
				},
				{
					type: ComponentTypesEnum.Button,
					sub_type: ButtonTypesEnum.URL,
					index: '0',
					parameters: [{ type: ParametersTypesEnum.Text, text: 'receipt-id' }],
				},
			],
		};
		const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`, {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: '1234',
				type: 'template',
				template,
			})
			.reply(200, defaultMessagesResponseBody);
		await wa.messages.template(template, testRecipient);
		expect(request.isDone()).toBe(true);
	});

	const interactivePayloads: InteractiveObject[] = [
		{
			type: InteractiveTypesEnum.List,
			body: { text: 'Choose' },
			action: {
				button: 'Open',
				sections: [{ rows: [{ id: 'one', title: 'One' }] }],
			},
		},
		{
			type: InteractiveTypesEnum.CtaUrl,
			body: { text: 'Visit' },
			action: {
				name: 'cta_url',
				parameters: { display_text: 'Website', url: 'https://example.com' },
			},
		},
		{
			type: InteractiveTypesEnum.Flow,
			body: { text: 'Start' },
			action: {
				name: 'flow',
				parameters: {
					flow_message_version: '3',
					flow_id: '123',
					flow_cta: 'Open',
					flow_action: 'navigate',
					flow_action_payload: { screen: 'START' },
				},
			},
		},
		{
			type: InteractiveTypesEnum.LocationRequest,
			body: { text: 'Share location' },
			action: { name: 'send_location' },
		},
	];
	it.each(interactivePayloads)(
		'sends interactive $type payloads',
		async (interactive) => {
			const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
				.post(
					`${basePath}/messages`,
					JSON.stringify({
						messaging_product: 'whatsapp',
						recipient_type: 'individual',
						to: '1234',
						type: 'interactive',
						interactive,
					}),
				)
				.reply(200, defaultMessagesResponseBody);
			await wa.messages.interactive(interactive, testRecipient);
			expect(request.isDone()).toBe(true);
		},
	);

	it('sends read receipts with typing indicators and types the success response', async () => {
		const request = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`, {
				messaging_product: 'whatsapp',
				status: 'read',
				message_id: 'original',
				typing_indicator: { type: 'text' },
			})
			.reply(200, { success: true });
		const response = await wa.messages.status({
			status: 'read',
			message_id: 'original',
			typing_indicator: { type: 'text' },
		});
		expect((await response.responseBodyToJSON()).success).toBe(true);
		expect(request.isDone()).toBe(true);
	});

	it('Send text message', async () => {
		scope = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`)
			.delay(200)
			.delayBody(200)
			.delayConnection(200)
			.reply(200, defaultMessagesResponseBody);

		const response = await wa.messages.text({ body: 'test' }, testRecipient);

		expect(await response.responseBodyToJSON()).toStrictEqual(
			defaultMessagesResponseBody,
		);
		scope.isDone();
	});

	it('Send meta-hosted audio message', async () => {
		scope = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`)
			.delay(200)
			.delayBody(200)
			.delayConnection(200)
			.reply(200, defaultMessagesResponseBody);

		const meta_hosted_audio = {
			id: '123456abcde',
			caption: 'My audio file',
			filename: 'example.mp4',
		};

		const response = await wa.messages.audio(meta_hosted_audio, testRecipient);

		expect(await response.responseBodyToJSON()).toStrictEqual(
			defaultMessagesResponseBody,
		);
		scope.isDone();
	});

	it('Send self-hosted audio message', async () => {
		scope = nock(`https://${sdkConfig.WA_BASE_URL}`)
			.post(`${basePath}/messages`)
			.delay(200)
			.delayBody(200)
			.delayConnection(200)
			.reply(200, defaultMessagesResponseBody);

		const selfHostedAudio = {
			link: new URL('https://example.com/example_1234.mp4').href,
			caption: 'My audio file',
			filename: 'example.mp4',
		};

		const response = await wa.messages.audio(selfHostedAudio, testRecipient);

		expect(await response.responseBodyToJSON()).toStrictEqual(
			defaultMessagesResponseBody,
		);
		scope.isDone();
	});
});
