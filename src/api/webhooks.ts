/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'node:crypto';
import * as w from '../types/webhooks';
import { RequesterClass } from '../types/requester';
import { WAConfigType } from '../types/config';
import { WAConfigEnum } from '../types/enums';
import { generateXHub256Sig } from '../utils';
import HttpsServer from '../httpsServer';
import BaseAPI from './base';
import Logger from '../logger';

const LIB_NAME = 'WEBHOOKS';
const LOG_LOCAL = false;
const LOGGER = new Logger(LIB_NAME, process.env.DEBUG === 'true' || LOG_LOCAL);

export default class WebhooksAPI extends BaseAPI implements w.WebhooksClass {
	userAgent: string;
	server?: HttpsServer;

	constructor(
		config: WAConfigType,
		HttpsClient: RequesterClass,
		userAgent: string,
	) {
		super(config, HttpsClient);
		this.userAgent = userAgent;
	}

	start(cb: w.WebhookCallback): boolean {
		if (this.isStarted()) throw new Error('Server already started');
		if (
			!this.config[WAConfigEnum.AppSecret] ||
			!this.config[WAConfigEnum.WebhookVerificationToken]
		) {
			throw new Error('Webhook app secret and verification token are required');
		}
		this.server = new HttpsServer(
			this.config[WAConfigEnum.ListenerPort],
			(req: IncomingMessage, res: ServerResponse) => {
				res.setHeader('User-Agent', this.userAgent);
				const fail = (status: number, message: string) => {
					if (res.writableEnded) return;
					res.writeHead(status);
					res.end(message);
					cb(status, req.headers, undefined, undefined, new Error(message));
				};
				let requestPath: URL;
				try {
					requestPath = new URL(req.url || '/', 'http://localhost');
				} catch {
					fail(400, 'Invalid webhook URL');
					return;
				}
				const endpoint = `/${this.config[WAConfigEnum.WebhookEndpoint].replace(/^\/+/, '')}`;
				if (requestPath.pathname !== endpoint) {
					res.writeHead(404).end();
					return;
				}
				if (req.method === 'GET') {
					const challenge = requestPath.searchParams.get('hub.challenge');
					if (
						requestPath.searchParams.get('hub.mode') === 'subscribe' &&
						requestPath.searchParams.get('hub.verify_token') ===
							this.config[WAConfigEnum.WebhookVerificationToken] &&
						challenge !== null
					) {
						res.end(challenge);
					} else {
						fail(401, 'Invalid webhook verification request');
					}
					return;
				}
				if (req.method !== 'POST') {
					res.setHeader('Allow', 'GET, POST');
					res.writeHead(405).end();
					return;
				}
				const signature = req.headers['x-hub-signature-256'];
				if (
					typeof signature !== 'string' ||
					!/^sha256=[a-f\d]{64}$/i.test(signature)
				) {
					fail(401, 'Missing or invalid webhook signature');
					req.resume();
					return;
				}
				const chunks: Buffer[] = [];
				let size = 0;
				req.on('data', (chunk: Buffer) => {
					if (res.writableEnded) return;
					size += chunk.length;
					if (size > 1e6) {
						chunks.length = 0;
						fail(413, 'Webhook payload exceeds 1 MB');
						return;
					}
					chunks.push(chunk);
				});
				req.on('end', () => {
					if (res.writableEnded) return;
					const body = Buffer.concat(chunks);
					const expected = Buffer.from(
						generateXHub256Sig(body, this.config[WAConfigEnum.AppSecret]),
						'hex',
					);
					if (
						!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
					) {
						fail(401, 'Webhook signature does not match');
						return;
					}
					let parsedBody: w.WebhookObject;
					try {
						parsedBody = JSON.parse(body.toString('utf8'));
					} catch {
						fail(400, 'Invalid webhook JSON');
						return;
					}
					LOGGER.log('Webhook signature verified');
					cb(200, req.headers, parsedBody, res, undefined);
				});
				req.on('error', () => fail(400, 'Webhook request interrupted'));
			},
		);

		return this.isStarted();
	}

	isStarted(): boolean {
		return this.server != null && this.server.isListening();
	}

	stop(cb: (err?: Error) => any): boolean {
		if (!this.server) {
			throw new Error('Server not started');
		}
		this.server.close(cb);
		return this.isStarted();
	}
}
