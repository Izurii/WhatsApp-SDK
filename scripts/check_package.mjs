import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const directory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'whatsapp-sdk-consumer-'),
);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const runNpm = (args) =>
	execFileSync(
		npm,
		process.platform === 'win32'
			? args.map((argument) => `"${argument}"`)
			: args,
		{
			encoding: 'utf8',
			shell: process.platform === 'win32',
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);

try {
	const [packed] = JSON.parse(
		runNpm(['pack', '--json', '--pack-destination', directory]),
	);
	runNpm([
		'install',
		'--prefix',
		directory,
		'--omit=dev',
		'--ignore-scripts',
		'--no-audit',
		'--no-fund',
		path.join(directory, packed.filename),
	]);
	const consumerRequire = createRequire(path.join(directory, 'package.json'));
	const WhatsApp = consumerRequire(packed.name);
	assert.equal(typeof WhatsApp, 'function');
	const imported = await import(
		pathToFileURL(consumerRequire.resolve(packed.name)).href
	);
	assert.equal(imported.default, WhatsApp);
	process.env.WA_PHONE_NUMBER_ID = '9007199254740993';
	process.env.CLOUD_API_ACCESS_TOKEN = 'local-test-token';
	process.env.CLOUD_API_VERSION = 'v26.0';
	delete process.env.NODE_ENV;
	const client = new WhatsApp();
	assert.equal(client.version(), packed.version);
	assert.equal(client.config.WA_PHONE_NUMBER_ID, '9007199254740993');
	client.requester.client.clearSockets();
	const source = `import WhatsApp, { type InteractiveObject, type WebhookObject, type MessageTemplateObject } from ${JSON.stringify(packed.name)};
const client = new WhatsApp('9007199254740993');
const interactive: InteractiveObject = { type: WhatsApp.Enums.InteractiveTypesEnum.CtaUrl, body: { text: 'Visit' }, action: { name: 'cta_url', parameters: { display_text: 'Open', url: 'https://example.com' } } };
const template: MessageTemplateObject = { name: 'receipt', language: { code: 'en_US' }, components: [{ type: WhatsApp.Enums.ComponentTypesEnum.Header, parameters: [{ type: WhatsApp.Enums.ParametersTypesEnum.Image, image: { id: 'media' } }] }] };
const webhook: WebhookObject = { object: 'whatsapp_business_account', entry: [] };
void client.messages.interactive(interactive, '15555550101');
void client.messages.template(template, '15555550101');
void webhook;`;
	const options = {
		noEmit: true,
		strict: true,
		isolatedModules: true,
		module: ts.ModuleKind.NodeNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		target: ts.ScriptTarget.ES2022,
		types: ['node'],
		typeRoots: [path.join(directory, 'node_modules/@types')],
	};
	for (const extension of ['mts', 'cts']) {
		const filename = path.join(directory, `consumer.${extension}`);
		const host = ts.createCompilerHost(options);
		const originalGetSourceFile = host.getSourceFile.bind(host);
		host.getSourceFile = (
			file,
			languageVersion,
			onError,
			shouldCreateNewSourceFile,
		) =>
			file === filename
				? ts.createSourceFile(file, source, languageVersion, true)
				: originalGetSourceFile(
						file,
						languageVersion,
						onError,
						shouldCreateNewSourceFile,
					);
		const program = ts.createProgram([filename], options, host);
		const diagnostics = ts.getPreEmitDiagnostics(program);
		assert.equal(
			diagnostics.length,
			0,
			ts.formatDiagnosticsWithColorAndContext(diagnostics, host),
		);
	}
	console.log(
		'Production install, CommonJS, ESM, and isolated TypeScript consumers passed.',
	);
} finally {
	fs.rmSync(directory, { recursive: true, force: true });
}
