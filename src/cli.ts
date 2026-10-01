#!/usr/bin/env node
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console -- the console is this command's interface. */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import WhatsApp from './WhatsApp';
import {
	ButtonTypesEnum,
	ComponentTypesEnum,
	HttpMethodsEnum,
	ParametersTypesEnum,
	WAConfigEnum,
} from './types/enums';
import { HttpsClientResponseClass } from './types/httpsClient';
import { MessageTemplateObject } from './types/messages';
import { WebhookObject } from './types/webhooks';
import { SDKVersion } from './version';

const BIN = 'whatsapp-sdk';
const MAX_TEXT_LENGTH = 4096;
const DEFAULT_STORE = '.whatsapp-statuses.jsonl';
const TIMEOUT_EXIT_CODE = 124;

const COMMON_OPTIONS_HELP = `Common options:
  --env-file <path>  Load variables from this file instead of ./.env
  --verbose          Print Cloud API error bodies and stack traces to stderr
  -h, --help         Show this help`;

const RECIPIENT_HELP = `  recipient  Recipient's international phone number, digits only (a leading
             "+" is allowed). This is not WA_PHONE_NUMBER_ID.`;

const SENDER_HELP = `  --from <id>        Sender phone number ID (overrides WA_PHONE_NUMBER_ID)
  --reply-to <id>    Send as a reply to this message ID (wamid)`;

const SEND_OUTPUT_HELP = `Prints {"message_id", "initial_status", "delivery_confirmed"} as JSON.
"accepted" means Meta is processing the message; it does not confirm
delivery. Subscribe a webhook to "messages" to receive delivery statuses.`;

const LISTEN_OPTIONS_HELP = `  --port <port>   Port to listen on (overrides LISTENER_PORT)
  --store <path>  Append status events to this file (default: ${DEFAULT_STORE})`;

const HELP = {
	'main': `Usage: ${BIN} <command> [options]

Commands:
  send text <recipient> <message>              Send a text message
  send template <recipient> <name> <language>  Send an approved template
  templates list                               List message templates
  templates get <name>                         Show a template's variables and buttons
  webhooks listen                              Receive and record status events
  status get <message-id>                      Show a message's recorded status
  status wait <message-id>                     Wait for a message's status

Options:
  --env-file <path>  Load variables from this file instead of ./.env
  --verbose          Print Cloud API error bodies and stack traces to stderr
  -h, --help         Show help (use after a command for command help)
  -v, --version      Print the version

Environment:
  CLOUD_API_ACCESS_TOKEN  Cloud API access token (required)
  CLOUD_API_VERSION       Graph API version, e.g. v23.0 (required)
  WA_PHONE_NUMBER_ID      Sender phone number ID (required to send)
  WA_BUSINESS_ACCOUNT_ID  WhatsApp Business account ID (required to list)
  M4D_APP_SECRET          App secret, to verify webhooks (required to listen)
  WEBHOOK_VERIFICATION_TOKEN
                          Webhook verify token (required to listen)
  WEBHOOK_ENDPOINT        Webhook path (default: /)
  LISTENER_PORT           Webhook port (default: 3000)
  WA_BASE_URL             API host (default: graph.facebook.com)
  REQUEST_TIMEOUT         Request timeout in milliseconds (default: 20000)

Variables are read from ./.env when it exists. Variables already set in the
environment take precedence.`,

	'send': `Usage: ${BIN} send <text|template> ...

Commands:
  send text <recipient> <message>              Send a text message
  send template <recipient> <name> <language>  Send an approved template

Run "${BIN} send text --help" or "${BIN} send template --help" for details.`,

	'send text': `Usage: ${BIN} send text <recipient> <message> [options]

Send a free-form text message. Text messages are only delivered inside an
open customer service window (24 hours after the user's last message); use a
template otherwise.

Arguments:
${RECIPIENT_HELP}
  message    Message body, up to ${MAX_TEXT_LENGTH} characters. Put "--" before a
             message that starts with "-".

Options:
  --preview-url      Render a link preview for the first URL in the message
${SENDER_HELP}

${COMMON_OPTIONS_HELP}

${SEND_OUTPUT_HELP}`,

	'send template': `Usage: ${BIN} send template <recipient> <name> <language> [options]

Send an approved message template.

Arguments:
${RECIPIENT_HELP}
  name       Template name, e.g. hello_world
  language   Template language code, e.g. en, en_US, or pt_BR

Options:
  --image-url <url>     Public HTTPS URL for an image header
  --video-url <url>     Public HTTPS URL for a video header
  --document-url <url>  Public HTTPS URL for a document header
  --params-file <path>  JSON file with parameter values (see below)
  --button-url <index>=<value>
                        Variable part of a URL button, or the code of a
                        one-time password button
  --button-payload <index>=<value>
                        Payload returned when a quick reply button is tapped
  --button-code <index>=<code>
                        Code for a copy code button
${SENDER_HELP}

Button indexes start at 0, in the order the template defines them.

The params file holds body parameters as an object for named parameters
({"customer_name": "Ana"}) or an array for positional ones (["Ana", "42"]).
To also fill a text header or buttons, use sections:

  {
    "header": {"customer_name": "Ana"},
    "body": {"order_id": "42"},
    "buttons": {"0": {"url": "42"}, "1": {"payload": "cancel"}}
  }

A button takes one of "url", "otp", "payload", or "coupon_code". Run
"${BIN} templates get <name>" for a ready-made params file.

${COMMON_OPTIONS_HELP}

${SEND_OUTPUT_HELP}`,

	'templates': `Usage: ${BIN} templates <list|get> [options]

Commands:
  templates list        List message templates
  templates get <name>  Show a template's variables, buttons, and parameters

Run "${BIN} templates list --help" or "${BIN} templates get --help" for details.`,

	'templates get': `Usage: ${BIN} templates get <name> [options]

Print each language version of a template as a JSON array, with its header,
body, footer, and buttons, the variables they take with Meta's examples, a
"params_file" skeleton for "send template --params-file", and a "send" example.

Options:
  --language <code>  Only show this language, e.g. pt_BR

${COMMON_OPTIONS_HELP}`,

	'templates list': `Usage: ${BIN} templates list [options]

Print every message template of WA_BUSINESS_ACCOUNT_ID as a JSON array of
{"name", "language", "category", "status"}.

${COMMON_OPTIONS_HELP}`,

	'webhooks': `Usage: ${BIN} webhooks listen [options]

Run "${BIN} webhooks listen --help" for details.`,

	'webhooks listen': `Usage: ${BIN} webhooks listen [options]

Start a webhook receiver on LISTENER_PORT at WEBHOOK_ENDPOINT, print each
message status event as a JSON line, and record it in the store file. Stop
with Ctrl+C.

The Cloud API only reports message statuses through webhooks: expose the port
through a public HTTPS URL (for example "ngrok http 3000"), set it as the
callback URL with WEBHOOK_VERIFICATION_TOKEN as the verify token, and
subscribe to the "messages" field.

Options:
${LISTEN_OPTIONS_HELP}

${COMMON_OPTIONS_HELP}`,

	'status': `Usage: ${BIN} status <get|wait> <message-id> [options]

Commands:
  status get <message-id>   Show the status recorded by "webhooks listen"
  status wait <message-id>  Receive webhooks until the message reaches a status

Run "${BIN} status get --help" or "${BIN} status wait --help" for details.`,

	'status get': `Usage: ${BIN} status get <message-id> [options]

Print the latest status recorded for a message by "webhooks listen" or
"status wait", with its history, as JSON. Fails when nothing was recorded.

Options:
  --store <path>  Status store file (default: ${DEFAULT_STORE})

${COMMON_OPTIONS_HELP}`,

	'status wait': `Usage: ${BIN} status wait <message-id> [options]

Wait until a message reaches a status, starting a webhook receiver like
"webhooks listen" unless the store already has it. Prints the matching event
as JSON. Exits with 0 when reached, 1 when the message failed, and
${TIMEOUT_EXIT_CODE} on timeout.

Options:
  --until <status>     sent, delivered, or read (default: delivered)
  --timeout <seconds>  Give up after this many seconds (default: 300)
${LISTEN_OPTIONS_HELP}

${COMMON_OPTIONS_HELP}`,
};

type HelpTopic = keyof typeof HELP;

const OPTIONS = {
	'env-file': { type: 'string' },
	'verbose': { type: 'boolean' },
	'help': { type: 'boolean', short: 'h' },
	'version': { type: 'boolean', short: 'v' },
	'from': { type: 'string' },
	'reply-to': { type: 'string' },
	'preview-url': { type: 'boolean' },
	'image-url': { type: 'string' },
	'video-url': { type: 'string' },
	'document-url': { type: 'string' },
	'params-file': { type: 'string' },
	'port': { type: 'string' },
	'store': { type: 'string' },
	'until': { type: 'string' },
	'timeout': { type: 'string' },
	'button-url': { type: 'string', multiple: true },
	'button-payload': { type: 'string', multiple: true },
	'button-code': { type: 'string', multiple: true },
	'language': { type: 'string' },
} as const;

type OptionName = keyof typeof OPTIONS;
type Options = ReturnType<
	typeof parseArgs<{ options: typeof OPTIONS }>
>['values'];

const COMMANDS = {
	'send text': {
		operands: ['recipient', 'message'],
		options: ['from', 'reply-to', 'preview-url'],
	},
	'send template': {
		operands: ['recipient', 'name', 'language'],
		options: [
			'from',
			'reply-to',
			'image-url',
			'video-url',
			'document-url',
			'params-file',
			'button-url',
			'button-payload',
			'button-code',
		],
	},
	'templates list': { operands: [], options: [] },
	'templates get': { operands: ['name'], options: ['language'] },
	'webhooks listen': { operands: [], options: ['port', 'store'] },
	'status get': { operands: ['message-id'], options: ['store'] },
	'status wait': {
		operands: ['message-id'],
		options: ['port', 'store', 'until', 'timeout'],
	},
} satisfies Record<string, { operands: string[]; options: OptionName[] }>;

type CommandName = keyof typeof COMMANDS;

const GLOBAL_OPTIONS: OptionName[] = ['env-file', 'verbose', 'help', 'version'];

class CliError extends Error {
	constructor(
		message: string,
		readonly exitCode = 1,
		readonly helpTopic?: HelpTopic,
		readonly details?: unknown,
	) {
		super(message);
	}
}

const usageError = (message: string, helpTopic: HelpTopic = 'main') =>
	new CliError(message, 2, helpTopic);

function parse(args: string[]) {
	try {
		return parseArgs({
			args,
			options: OPTIONS,
			allowPositionals: true,
			strict: true,
		});
	} catch (error) {
		throw usageError(
			error instanceof Error ? error.message.split('\n')[0] : String(error),
		);
	}
}

function helpTopicFor(positionals: string[]): HelpTopic {
	const [group, action] = positionals;
	const command = `${group} ${action}`;
	if (Object.hasOwn(HELP, command)) return command as HelpTopic;
	if (Object.hasOwn(HELP, group)) return group as HelpTopic;
	return 'main';
}

function resolveCommand(positionals: string[], values: Options) {
	const [group, action, ...operands] = positionals;
	const name = `${group} ${action}`;
	if (!Object.hasOwn(COMMANDS, name)) {
		if (group !== 'main' && Object.hasOwn(HELP, group)) {
			throw usageError(
				action
					? `Unknown command "${group} ${action}".`
					: `Missing subcommand for "${group}".`,
				group as HelpTopic,
			);
		}
		throw usageError(`Unknown command "${group}".`);
	}
	const command = name as CommandName;
	const spec = COMMANDS[command];

	for (const option of Object.keys(values) as OptionName[]) {
		if (
			!GLOBAL_OPTIONS.includes(option) &&
			!(spec.options as OptionName[]).includes(option)
		) {
			throw usageError(
				`Option --${option} is not supported by "${command}".`,
				command,
			);
		}
	}
	if (operands.length !== spec.operands.length) {
		const expected = spec.operands.map((operand) => `<${operand}>`).join(' ');
		throw usageError(
			operands.length < spec.operands.length
				? `Missing arguments. Expected: ${command} ${expected}`.trimEnd()
				: `Too many arguments for "${command}". If the message contains spaces, quote it.`,
			command,
		);
	}
	return { command, operands };
}

function parseRecipient(value: string, command: HelpTopic): string {
	const digits = value.replace(/^\+/, '');
	if (!/^\d{6,15}$/.test(digits)) {
		throw usageError(
			'<recipient> must be an international phone number with 6 to 15 digits, e.g. 15555550101.',
			command,
		);
	}
	return digits;
}

function parseHttpsUrl(value: string, option: string): string {
	try {
		const url = new URL(value);
		if (url.protocol === 'https:' && !url.username && !url.password) {
			return url.href;
		}
	} catch {
		// Reported below.
	}
	throw usageError(
		`--${option} must be a public HTTPS URL without credentials.`,
		'send template',
	);
}

type TextParameter = {
	type: ParametersTypesEnum.Text;
	text: string;
	parameter_name?: string;
};

const BUTTON_PARAMETERS = ['url', 'otp', 'payload', 'coupon_code'] as const;
type ButtonParameter = (typeof BUTTON_PARAMETERS)[number];
type ButtonValues = Map<number, { parameter: ButtonParameter; value: string }>;
type TemplateParameters = {
	header?: TextParameter[];
	body?: TextParameter[];
	buttons: ButtonValues;
};

const BUTTON_OPTIONS = {
	'button-url': 'url',
	'button-payload': 'payload',
	'button-code': 'coupon_code',
} as const satisfies Partial<Record<OptionName, ButtonParameter>>;

const PARAMS_FILE_FORMAT =
	'--params-file must contain a nonempty JSON object (named parameters), an array (positional parameters), or an object with "header", "body", and "buttons" sections.';

function parameterText(value: unknown, label: string): string {
	if (
		(typeof value !== 'string' && typeof value !== 'number') ||
		!String(value).trim()
	) {
		throw usageError(`${label} must be a nonempty string.`, 'send template');
	}
	return String(value);
}

function textParameters(values: unknown, label: string): TextParameter[] {
	if (Array.isArray(values) && values.length) {
		return values.map((value, index) => ({
			type: ParametersTypesEnum.Text,
			text: parameterText(value, `${label}: parameter ${index + 1}`),
		}));
	}
	if (
		values &&
		typeof values === 'object' &&
		!Array.isArray(values) &&
		Object.keys(values).length
	) {
		return Object.entries(values).map(([name, value]) => {
			if (!/^[a-z0-9_]+$/.test(name)) {
				throw usageError(
					`${label}: parameter name "${name}" may only contain lowercase letters, digits, and underscores.`,
					'send template',
				);
			}
			return {
				type: ParametersTypesEnum.Text,
				parameter_name: name,
				text: parameterText(value, `${label}: "${name}"`),
			};
		});
	}
	throw usageError(PARAMS_FILE_FORMAT, 'send template');
}

function parseButtonIndex(value: string, label: string): number {
	if (!/^\d$/.test(value)) {
		throw usageError(
			`${label}: button index must be a number from 0 to 9.`,
			'send template',
		);
	}
	return Number(value);
}

function addButton(
	buttons: ButtonValues,
	index: number,
	parameter: ButtonParameter,
	value: string,
) {
	if (buttons.has(index)) {
		throw usageError(
			`Button ${index} has more than one parameter.`,
			'send template',
		);
	}
	buttons.set(index, { parameter, value });
}

/**
 * Reads template parameters. A flat object or array holds body parameters; an
 * object whose values include objects or arrays holds sections.
 */
function readParamsFile(path: string): TemplateParameters {
	const label = '--params-file';
	let values: unknown;
	try {
		values = JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		throw usageError(
			`Unable to read --params-file "${path}" as JSON.`,
			'send template',
		);
	}
	const sectioned =
		values !== null &&
		typeof values === 'object' &&
		!Array.isArray(values) &&
		Object.values(values).some(
			(value) => value !== null && typeof value === 'object',
		);
	if (!sectioned) {
		return { body: textParameters(values, label), buttons: new Map() };
	}

	const sections = values as Record<string, unknown>;
	const unknown = Object.keys(sections).find(
		(key) => !['header', 'body', 'buttons'].includes(key),
	);
	if (unknown !== undefined) {
		throw usageError(
			`${label}: unknown section "${unknown}". Use "header", "body", and "buttons".`,
			'send template',
		);
	}
	const buttons: ButtonValues = new Map();
	if (sections.buttons !== undefined) {
		if (
			!sections.buttons ||
			typeof sections.buttons !== 'object' ||
			Array.isArray(sections.buttons)
		) {
			throw usageError(
				`${label}: "buttons" must be an object keyed by button index, e.g. {"0": {"url": "abc"}}.`,
				'send template',
			);
		}
		for (const [key, spec] of Object.entries(sections.buttons)) {
			const buttonLabel = `${label}: button ${key}`;
			const index = parseButtonIndex(key, buttonLabel);
			const entries =
				spec && typeof spec === 'object' && !Array.isArray(spec)
					? Object.entries(spec)
					: [];
			const [parameter, value] = entries[0] ?? [];
			if (
				entries.length !== 1 ||
				!BUTTON_PARAMETERS.includes(parameter as ButtonParameter)
			) {
				throw usageError(
					`${buttonLabel} must be an object with one of ${BUTTON_PARAMETERS.map((name) => `"${name}"`).join(', ')}.`,
					'send template',
				);
			}
			addButton(
				buttons,
				index,
				parameter as ButtonParameter,
				parameterText(value, `${buttonLabel} "${parameter}"`),
			);
		}
	}
	return {
		header:
			sections.header === undefined
				? undefined
				: textParameters(sections.header, `${label}: header`),
		body:
			sections.body === undefined
				? undefined
				: textParameters(sections.body, `${label}: body`),
		buttons,
	};
}

function buttonComponent(
	index: number,
	parameter: ButtonParameter,
	value: string,
): NonNullable<MessageTemplateObject['components']>[number] {
	const button = {
		type: ComponentTypesEnum.Button,
		index: `${index}`,
	} as const;
	switch (parameter) {
		case 'payload':
			return {
				...button,
				sub_type: ButtonTypesEnum.QuickReply,
				parameters: [{ type: ParametersTypesEnum.Payload, payload: value }],
			};
		case 'coupon_code':
			return {
				...button,
				sub_type: ButtonTypesEnum.CopyCode,
				parameters: [
					{ type: ParametersTypesEnum.CouponCode, coupon_code: value },
				],
			};
		default:
			// One-time password buttons take the code as a URL parameter.
			return {
				...button,
				sub_type: ButtonTypesEnum.URL,
				parameters: [{ type: ParametersTypesEnum.Text, text: value }],
			};
	}
}

function buildTemplate(
	name: string,
	language: string,
	values: Options,
): MessageTemplateObject {
	const command = 'send template';
	validateTemplateName(name, command);
	if (!/^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(language)) {
		throw usageError(
			'<language> must be a template language code such as en, en_US, or pt_BR.',
			command,
		);
	}

	const template: MessageTemplateObject = {
		name,
		language: { code: language },
	};
	const media = (['image-url', 'video-url', 'document-url'] as const).filter(
		(option) => values[option] !== undefined,
	);
	if (media.length > 1) {
		throw usageError(
			`Use only one header option (got ${media.map((option) => `--${option}`).join(', ')}).`,
			command,
		);
	}
	const params: TemplateParameters =
		values['params-file'] === undefined
			? { buttons: new Map() }
			: readParamsFile(values['params-file']);
	const { buttons } = params;
	for (const [option, parameter] of Object.entries(BUTTON_OPTIONS)) {
		for (const entry of values[option as keyof typeof BUTTON_OPTIONS] ?? []) {
			const match = /^([^=]*)=(.*)$/s.exec(entry);
			if (!match) {
				throw usageError(
					`--${option} must look like <index>=<value>, e.g. 0=abc.`,
					command,
				);
			}
			addButton(
				buttons,
				parseButtonIndex(match[1], `--${option}`),
				parameter,
				parameterText(match[2], `--${option} ${match[1]}`),
			);
		}
	}

	const components: NonNullable<MessageTemplateObject['components']> = [];
	if (media.length && params.header) {
		throw usageError(
			`A header has either media or text: remove --${media[0]} or the "header" section of --params-file.`,
			command,
		);
	}
	if (values['image-url'] !== undefined) {
		const link = parseHttpsUrl(values['image-url'], 'image-url');
		components.push({
			type: ComponentTypesEnum.Header,
			parameters: [{ type: ParametersTypesEnum.Image, image: { link } }],
		});
	} else if (values['video-url'] !== undefined) {
		const link = parseHttpsUrl(values['video-url'], 'video-url');
		components.push({
			type: ComponentTypesEnum.Header,
			parameters: [{ type: ParametersTypesEnum.Video, video: { link } }],
		});
	} else if (values['document-url'] !== undefined) {
		const link = parseHttpsUrl(values['document-url'], 'document-url');
		components.push({
			type: ComponentTypesEnum.Header,
			parameters: [{ type: ParametersTypesEnum.Document, document: { link } }],
		});
	} else if (params.header) {
		components.push({
			type: ComponentTypesEnum.Header,
			parameters: params.header,
		});
	}
	if (params.body) {
		components.push({ type: ComponentTypesEnum.Body, parameters: params.body });
	}
	for (const [index, { parameter, value }] of [...buttons].sort(
		([a], [b]) => a - b,
	)) {
		components.push(buttonComponent(index, parameter, value));
	}
	if (components.length) template.components = components;
	return template;
}

function validateTemplateName(name: string, command: HelpTopic) {
	if (!/^[a-z0-9_]{1,512}$/.test(name)) {
		throw usageError(
			'<name> may only contain lowercase letters, digits, and underscores.',
			command,
		);
	}
}

function loadEnv(path: string | undefined, required: boolean) {
	if (!path) return;
	if (!existsSync(path)) {
		if (required) throw new CliError(`Env file "${path}" does not exist.`);
		return;
	}
	let parsed: NodeJS.Dict<string>;
	try {
		parsed = parseEnv(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new CliError(
			`Unable to read env file "${path}".`,
			1,
			undefined,
			error,
		);
	}
	for (const [key, value] of Object.entries(parsed)) {
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

function requireEnv(names: string[]) {
	const missing = names.filter((name) => !process.env[name]?.trim());
	if (missing.length) {
		throw new CliError(
			`Missing ${missing.join(', ')}. Set ${missing.length > 1 ? 'them' : 'it'} in the environment or in an env file.`,
		);
	}
	for (const name of names) {
		if (name.endsWith('_ID') && !/^\d+$/.test(process.env[name]!)) {
			throw new CliError(`${name} must contain digits only.`);
		}
	}
}

async function assertOk(response: HttpsClientResponseClass) {
	const status = response.statusCode();
	if (status >= 200 && status < 300) return;
	const body = await response.responseBodyToJSON().catch(() => undefined);
	const error = body?.error as Record<string, unknown> | undefined;
	const code =
		typeof error?.code === 'number' ? `, error code ${error.code}` : '';
	const subcode =
		typeof error?.error_subcode === 'number'
			? `, subcode ${error.error_subcode}`
			: '';
	throw new CliError(
		`Cloud API returned HTTP ${status}${code}${subcode}.`,
		1,
		undefined,
		body,
	);
}

async function printSendResult(response: HttpsClientResponseClass) {
	await assertOk(response);
	const body = await response.responseBodyToJSON();
	const message = (body.messages as Record<string, unknown>[] | undefined)?.[0];
	if (typeof message?.id !== 'string') {
		throw new CliError(
			'Unexpected response from the Cloud API.',
			1,
			undefined,
			body,
		);
	}
	const status = message.message_status;
	console.log(
		JSON.stringify({
			message_id: message.id,
			initial_status:
				typeof status === 'string' &&
				['accepted', 'held_for_quality_assessment', 'paused'].includes(status)
					? status
					: 'unknown',
			delivery_confirmed: false,
		}),
	);
}

async function* fetchTemplates(
	client: WhatsApp,
	query: Record<string, string>,
): AsyncGenerator<Record<string, unknown>> {
	const { requester } = client;
	const seenCursors = new Set<string>();
	let cursor: string | undefined;
	do {
		const search = new URLSearchParams({ ...query, limit: '100' });
		if (cursor) search.set('after', cursor);
		const response = await requester.client.sendRequest(
			requester.host,
			requester.port,
			`/${encodeURIComponent(requester.apiVersion)}/${process.env.WA_BUSINESS_ACCOUNT_ID}/message_templates?${search}`,
			HttpMethodsEnum.Get,
			requester.buildHeader('application/json'),
			client.config[WAConfigEnum.RequestTimeout],
		);
		await assertOk(response);
		const body = await response.responseBodyToJSON();
		if (
			!Array.isArray(body.data) ||
			body.data.some((entry) => !entry || typeof entry !== 'object')
		) {
			throw new CliError(
				'Unexpected response from the Cloud API.',
				1,
				undefined,
				body,
			);
		}
		yield* body.data;
		const paging = body.paging as
			{ next?: string; cursors?: { after?: string } } | undefined;
		cursor = paging?.next
			? paging.cursors?.after ||
				new URL(paging.next).searchParams.get('after') ||
				undefined
			: undefined;
		if (paging?.next && (!cursor || seenCursors.has(cursor))) {
			throw new CliError('The Cloud API returned an invalid page cursor.');
		}
		if (cursor) seenCursors.add(cursor);
	} while (cursor);
}

async function listTemplates(client: WhatsApp) {
	const templates: Record<string, unknown>[] = [];
	for await (const { name, language, category, status } of fetchTemplates(
		client,
		{ fields: 'name,language,category,status' },
	)) {
		templates.push({ name, language, category, status });
	}
	console.log(JSON.stringify(templates, null, 2));
}

type TemplateComponent = {
	type?: string;
	format?: string;
	text?: string;
	example?: {
		header_text?: string[];
		header_text_named_params?: { param_name: string; example: string }[];
		body_text?: string[][];
		body_text_named_params?: { param_name: string; example: string }[];
	};
	buttons?: {
		type?: string;
		text?: string;
		url?: string;
		phone_number?: string;
		example?: string | string[];
	}[];
};

type Variable = { name: string; example?: string };

function variables(
	text: string | undefined,
	named: { param_name: string; example: string }[] | undefined,
	positional: string[] | undefined,
): Variable[] {
	const names = new Set(
		[...(text ?? '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(
			(match) => match[1],
		),
	);
	return [...names].map((name) => {
		const example =
			named?.find((param) => param.param_name === name)?.example ??
			(/^\d+$/.test(name) ? positional?.[Number(name) - 1] : undefined);
		return example === undefined ? { name } : { name, example };
	});
}

/** Parameters as `send template --params-file` expects them. */
function parameterValues(vars: Variable[], positional: boolean) {
	return positional
		? vars.map((variable) => variable.example ?? '')
		: Object.fromEntries(
				vars.map((variable) => [variable.name, variable.example ?? '']),
			);
}

const MEDIA_OPTIONS: Record<string, string> = {
	IMAGE: '--image-url <https-url>',
	VIDEO: '--video-url <https-url>',
	DOCUMENT: '--document-url <https-url>',
};

function describeTemplate(template: Record<string, unknown>) {
	const components = (
		Array.isArray(template.components) ? template.components : []
	) as TemplateComponent[];
	const positional = template.parameter_format !== 'NAMED';
	const description: Record<string, unknown> = {
		name: template.name,
		language: template.language,
		status: template.status,
		category: template.category,
		parameter_format: positional ? 'POSITIONAL' : 'NAMED',
	};
	const params: Record<string, unknown> = {};
	const options: string[] = [];

	for (const component of components) {
		const type = component.type?.toUpperCase();
		if (type === 'HEADER') {
			const format = component.format?.toUpperCase() ?? 'TEXT';
			if (format === 'TEXT') {
				const vars = variables(
					component.text,
					component.example?.header_text_named_params,
					component.example?.header_text,
				);
				description.header = { format, text: component.text, variables: vars };
				if (vars.length) params.header = parameterValues(vars, positional);
			} else {
				description.header = { format };
				options.push(
					MEDIA_OPTIONS[format] ??
						`(${format.toLowerCase()} headers are not supported by this command)`,
				);
			}
		} else if (type === 'BODY') {
			const vars = variables(
				component.text,
				component.example?.body_text_named_params,
				component.example?.body_text?.[0],
			);
			description.body = { text: component.text, variables: vars };
			if (vars.length) params.body = parameterValues(vars, positional);
		} else if (type === 'FOOTER') {
			description.footer = component.text;
		} else if (type === 'BUTTONS') {
			const buttonParams: Record<string, Record<string, string>> = {};
			description.buttons = (component.buttons ?? []).map((button, index) => {
				const buttonType = button.type?.toUpperCase();
				const examples = [button.example ?? []].flat();
				let parameter: { name: ButtonParameter; required: boolean } | undefined;
				let example: string | undefined;
				if (buttonType === 'URL' && button.url?.includes('{{')) {
					parameter = { name: 'url', required: true };
					const prefix = button.url.split('{{')[0];
					example = examples[0]?.startsWith(prefix)
						? examples[0].slice(prefix.length)
						: examples[0];
				} else if (buttonType === 'OTP') {
					parameter = { name: 'otp', required: true };
				} else if (buttonType === 'COPY_CODE') {
					parameter = { name: 'coupon_code', required: true };
					example = examples[0];
				} else if (buttonType === 'QUICK_REPLY') {
					parameter = { name: 'payload', required: false };
				}
				if (parameter?.required) {
					buttonParams[index] = { [parameter.name]: example ?? '' };
				}
				return {
					index,
					type: buttonType,
					text: button.text,
					...(button.url ? { url: button.url } : {}),
					...(button.phone_number ? { phone_number: button.phone_number } : {}),
					...(parameter
						? {
								parameter: {
									...parameter,
									...(example === undefined ? {} : { example }),
								},
							}
						: {}),
				};
			});
			if (Object.keys(buttonParams).length) params.buttons = buttonParams;
		}
	}

	if (Object.keys(params).length) {
		description.params_file = params;
		options.push('--params-file params.json');
	}
	description.send = [
		`${BIN} send template <recipient> ${template.name} ${template.language}`,
		...options,
	].join(' ');
	return description;
}

async function getTemplate(
	client: WhatsApp,
	name: string,
	language: string | undefined,
) {
	const versions = [];
	for await (const template of fetchTemplates(client, {
		fields: 'name,language,status,category,parameter_format,components',
		name,
	})) {
		// The API matches names partially, so keep exact matches only.
		if (
			template.name === name &&
			(language === undefined || template.language === language)
		) {
			versions.push(describeTemplate(template));
		}
	}
	if (!versions.length) {
		throw new CliError(
			`Template "${name}"${language ? ` in ${language}` : ''} not found. Run "${BIN} templates list" to see the available templates.`,
		);
	}
	console.log(JSON.stringify(versions, null, 2));
}

type StatusEvent = {
	message_id: string;
	status: string;
	timestamp: string;
	errors?: { code: number; title: string }[];
};

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

function statusEvents(body: WebhookObject | undefined): StatusEvent[] {
	const events: StatusEvent[] = [];
	for (const entry of body?.entry ?? []) {
		for (const change of entry?.changes ?? []) {
			for (const status of change?.value?.statuses ?? []) {
				if (typeof status?.id !== 'string' || typeof status.status !== 'string')
					continue;
				const seconds = Number(status.timestamp);
				events.push({
					message_id: status.id,
					status: status.status,
					timestamp: Number.isFinite(seconds)
						? new Date(seconds * 1000).toISOString()
						: String(status.timestamp),
					...(status.errors?.length
						? {
								errors: status.errors.map(({ code, title }) => ({
									code,
									title,
								})),
							}
						: {}),
				});
			}
		}
	}
	return events;
}

function readStore(path: string): StatusEvent[] {
	if (!existsSync(path)) return [];
	return readFileSync(path, 'utf8')
		.split('\n')
		.flatMap((line) => {
			try {
				const event = JSON.parse(line);
				return typeof event?.message_id === 'string' &&
					typeof event.status === 'string'
					? [event as StatusEvent]
					: [];
			} catch {
				return [];
			}
		});
}

/**
 * A failure wins; otherwise the most advanced status wins, because webhooks
 * can arrive out of order.
 */
function latestStatus(events: StatusEvent[]): StatusEvent | undefined {
	return (
		events.find((event) => event.status === 'failed') ??
		events.reduce<StatusEvent | undefined>(
			(latest, event) =>
				!latest ||
				(STATUS_RANK[event.status] ?? 0) >= (STATUS_RANK[latest.status] ?? 0)
					? event
					: latest,
			undefined,
		)
	);
}

function failure(event: StatusEvent) {
	const codes = event.errors?.map((error) => error.code).join(', ');
	return new CliError(
		`The message failed${codes ? ` with error code ${codes}` : ''}.`,
	);
}

function parsePort(value: string, command: HelpTopic): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw usageError('--port must be a number between 1 and 65535.', command);
	}
	return port;
}

/** Aborts on Ctrl+C unless the caller supplies its own signal. */
function interruption(signal?: AbortSignal) {
	if (signal) return { signal, dispose: () => undefined };
	const controller = new AbortController();
	const abort = () => controller.abort();
	process.once('SIGINT', abort).once('SIGTERM', abort);
	return {
		signal: controller.signal,
		dispose: () => {
			process.off('SIGINT', abort).off('SIGTERM', abort);
		},
	};
}

/**
 * Receives webhooks until `signal` aborts or `onEvent` returns true, appending
 * every status event to `store`.
 */
function listen(
	client: WhatsApp,
	store: string,
	signal: AbortSignal,
	onEvent: (event: StatusEvent) => boolean,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let done = false;
		const finish = (error?: unknown) => {
			if (done) return;
			done = true;
			signal.removeEventListener('abort', onAbort);
			client.webhooks.stop(() => (error ? reject(error) : resolve()));
		};
		const onAbort = () => finish();

		client.webhooks.start((statusCode, _headers, body, response, error) => {
			if (error) {
				console.error(
					`warning: rejected a webhook request (HTTP ${statusCode}: ${error.message}).`,
				);
				return;
			}
			response?.writeHead(200).end();
			for (const event of statusEvents(body)) {
				try {
					appendFileSync(store, `${JSON.stringify(event)}\n`);
				} catch (cause) {
					finish(
						new CliError(`Unable to write to "${store}".`, 1, undefined, cause),
					);
					return;
				}
				if (!done && onEvent(event)) finish();
			}
		});

		const server = client.webhooks.server!.server;
		server.once('error', finish);
		server.once('listening', () => {
			const endpoint = `/${client.config[WAConfigEnum.WebhookEndpoint].replace(/^\/+/, '')}`;
			console.error(
				`Listening for webhooks on http://localhost:${client.config[WAConfigEnum.ListenerPort]}${endpoint}`,
			);
		});
		if (signal.aborted) finish();
		else signal.addEventListener('abort', onAbort, { once: true });
	});
}

async function waitForStatus(
	client: WhatsApp,
	messageId: string,
	until: string,
	timeoutSeconds: number,
	store: string,
	signal: AbortSignal,
): Promise<number> {
	const isFinal = (event: StatusEvent) =>
		event.status === 'failed' ||
		(STATUS_RANK[event.status] ?? 0) >= STATUS_RANK[until];
	const settle = (event: StatusEvent) => {
		console.log(JSON.stringify(event));
		if (event.status === 'failed') throw failure(event);
		return 0;
	};

	const recorded = readStore(store).find(
		(event) => event.message_id === messageId && isFinal(event),
	);
	if (recorded) return settle(recorded);

	let match: StatusEvent | undefined;
	const controller = new AbortController();
	const stop = () => controller.abort();
	const timer = setTimeout(stop, timeoutSeconds * 1000);
	signal.addEventListener('abort', stop, { once: true });
	try {
		await listen(client, store, controller.signal, (event) => {
			if (event.message_id !== messageId) return false;
			console.error(`Status: ${event.status}`);
			if (!isFinal(event)) return false;
			match = event;
			return true;
		});
	} finally {
		clearTimeout(timer);
		signal.removeEventListener('abort', stop);
	}
	if (match) return settle(match);
	if (signal.aborted) return 130;
	throw new CliError(
		`Timed out after ${timeoutSeconds}s before the message was ${until}.`,
		TIMEOUT_EXIT_CODE,
	);
}

function report(error: unknown, verbose: boolean): number {
	if (error instanceof CliError) {
		console.error(`error: ${error.message}`);
		if (error.helpTopic) {
			const topic = error.helpTopic === 'main' ? '' : ` ${error.helpTopic}`;
			console.error(`Run "${BIN}${topic} --help" for usage.`);
		}
		if (verbose && error.details !== undefined) {
			console.error(
				error.details instanceof Error
					? error.details
					: JSON.stringify(error.details, null, 2),
			);
		}
		return error.exitCode;
	}

	const code = (error as NodeJS.ErrnoException | undefined)?.code;
	if (code === 'ETIMEDOUT') {
		console.error(
			'error: Request timed out. Check your network or raise REQUEST_TIMEOUT (milliseconds).',
		);
	} else if (typeof code === 'string' && /^E[A-Z_]+$/.test(code)) {
		console.error(
			`error: Network error (${code}). Check WA_BASE_URL and your connection.`,
		);
	} else {
		console.error(
			'error: Unexpected failure. Run again with --verbose for details.',
		);
	}
	if (verbose) console.error(error);
	return 1;
}

/**
 * Runs the `whatsapp-sdk` command line and resolves to its exit code:
 * 0 on success, 1 on configuration, network, or API errors, and 2 on usage
 * errors. `defaultEnvFile` is loaded when it exists and `--env-file` is not set.
 * `signal` stops the webhook commands; it defaults to Ctrl+C.
 */
export async function runCli(
	args: string[],
	defaultEnvFile?: string,
	signal?: AbortSignal,
): Promise<number> {
	let verbose = args.includes('--verbose');
	let client: WhatsApp | undefined;
	try {
		const { values, positionals } = parse(args);
		verbose = values.verbose ?? false;

		if (positionals[0] === 'help') {
			console.log(HELP[helpTopicFor(positionals.slice(1))]);
			return 0;
		}
		if (values.help) {
			console.log(HELP[helpTopicFor(positionals)]);
			return 0;
		}
		if (values.version) {
			console.log(SDKVersion);
			return 0;
		}
		if (!positionals.length) {
			console.error(HELP.main);
			return 2;
		}

		const { command, operands } = resolveCommand(positionals, values);

		// Validate everything that does not need configuration before loading it.
		let send:
			((client: WhatsApp) => Promise<HttpsClientResponseClass>) | undefined;
		if (command === 'send text') {
			const recipient = parseRecipient(operands[0], command);
			const message = operands[1];
			if (!message.trim())
				throw usageError('<message> must not be empty.', command);
			if (message.length > MAX_TEXT_LENGTH) {
				throw usageError(
					`<message> must be at most ${MAX_TEXT_LENGTH} characters.`,
					command,
				);
			}
			const body = values['preview-url']
				? { body: message, preview_url: true }
				: { body: message };
			send = (client) =>
				client.messages.text(body, recipient, values['reply-to']);
		} else if (command === 'send template') {
			const recipient = parseRecipient(operands[0], command);
			const template = buildTemplate(operands[1], operands[2], values);
			send = (client) =>
				client.messages.template(template, recipient, values['reply-to']);
		}
		if (send && values.from !== undefined && !/^\d+$/.test(values.from)) {
			throw usageError(
				'--from must be a phone number ID (digits only).',
				command,
			);
		}
		if (
			send &&
			values['reply-to'] !== undefined &&
			!values['reply-to'].trim()
		) {
			throw usageError('--reply-to must not be empty.', command);
		}

		loadEnv(values['env-file'] ?? defaultEnvFile, !!values['env-file']);

		if (send) {
			requireEnv([
				'CLOUD_API_ACCESS_TOKEN',
				'CLOUD_API_VERSION',
				...(values.from === undefined ? ['WA_PHONE_NUMBER_ID'] : []),
			]);
			client = new WhatsApp(values.from);
			await printSendResult(await send(client));
			return 0;
		}

		const store = values.store ?? DEFAULT_STORE;
		if (command === 'status get') {
			const events = readStore(store).filter(
				(event) => event.message_id === operands[0],
			);
			const latest = latestStatus(events);
			if (!latest) {
				throw new CliError(
					`No status recorded for this message in "${store}". Statuses only arrive through webhooks; run "${BIN} webhooks listen" or "${BIN} status wait" while the message is delivered.`,
				);
			}
			console.log(
				JSON.stringify(
					{
						...latest,
						history: events.map(({ status, timestamp }) => ({
							status,
							timestamp,
						})),
					},
					null,
					2,
				),
			);
			return 0;
		}

		if (command === 'templates list' || command === 'templates get') {
			if (command === 'templates get') {
				validateTemplateName(operands[0], command);
			}
			requireEnv([
				'CLOUD_API_ACCESS_TOKEN',
				'CLOUD_API_VERSION',
				'WA_BUSINESS_ACCOUNT_ID',
			]);
			// Reading templates does not use the sender, so any valid ID will do.
			client = new WhatsApp('0');
			if (command === 'templates list') await listTemplates(client);
			else await getTemplate(client, operands[0], values.language);
			return 0;
		}

		const until = values.until ?? 'delivered';
		if (!Object.hasOwn(STATUS_RANK, until)) {
			throw usageError('--until must be sent, delivered, or read.', command);
		}
		const timeout = Number(values.timeout ?? 300);
		if (!Number.isFinite(timeout) || timeout <= 0) {
			throw usageError(
				'--timeout must be a positive number of seconds.',
				command,
			);
		}
		const port =
			values.port === undefined ? undefined : parsePort(values.port, command);
		requireEnv([
			'CLOUD_API_ACCESS_TOKEN',
			'CLOUD_API_VERSION',
			'M4D_APP_SECRET',
			'WEBHOOK_VERIFICATION_TOKEN',
		]);
		// Receiving webhooks does not use the sender, so any valid ID will do.
		client = new WhatsApp('0');
		if (port !== undefined) client.config[WAConfigEnum.ListenerPort] = port;
		const interrupt = interruption(signal);
		try {
			if (command === 'status wait') {
				return await waitForStatus(
					client,
					operands[0],
					until,
					timeout,
					store,
					interrupt.signal,
				);
			}
			await listen(client, store, interrupt.signal, (event) => {
				console.log(JSON.stringify(event));
				return false;
			});
			return 0;
		} finally {
			interrupt.dispose();
		}
	} catch (error) {
		return report(error, verbose);
	} finally {
		client?.requester.client.clearSockets();
	}
}

if (require.main === module) {
	runCli(process.argv.slice(2), '.env').then((code) => {
		process.exitCode = code;
	});
}
