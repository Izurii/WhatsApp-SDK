/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IncomingMessage } from 'http';
import { request, Agent } from 'https';
import {
	HttpsClientClass,
	HttpsClientResponseClass,
	RequestHeaders,
	RequestData,
	ResponseHeaders,
	ResponseJSONBody,
} from './types/httpsClient';
import Logger from './logger';
import { HttpMethodsEnum } from './types/enums';

const LIB_NAME = 'HttpsClient';
const LOG_LOCAL = false;
const LOGGER = new Logger(LIB_NAME, process.env.DEBUG === 'true' || LOG_LOCAL);

export default class HttpsClient implements HttpsClientClass {
	agent: Agent;

	constructor() {
		this.agent = new Agent({ keepAlive: true });
	}

	clearSockets(): boolean {
		this.agent.destroy();
		return true;
	}

	async sendRequest(
		hostname: string,
		port: number,
		path: string,
		method: string,
		headers: RequestHeaders,
		timeout: number,
		requestData?: RequestData,
	): Promise<HttpsClientResponseClass> {
		const agent = this.agent;

		return new Promise<HttpsClientResponseClass>((resolve, reject) => {
			const req = request({
				hostname: hostname,
				port: port,
				path: path,
				method: method,
				agent: agent,
				headers: headers,
			});

			LOGGER.log({
				hostname: hostname,
				port: port,
				path,
				method,
			});

			const deadline = setTimeout(() => {
				req.destroy(
					Object.assign(new Error(`Request timed out after ${timeout}ms`), {
						code: 'ETIMEDOUT',
					}),
				);
			}, timeout);
			deadline.unref();
			req.once('close', () => clearTimeout(deadline));

			req.on('response', (resp) => {
				resolve(new HttpsClientResponse(resp));
			});

			req.on('error', (error) => {
				reject(error);
			});

			req.end(
				method === HttpMethodsEnum.Post || method === HttpMethodsEnum.Put
					? requestData
					: undefined,
			);
		});
	}
}

export class HttpsClientResponse implements HttpsClientResponseClass {
	resp: IncomingMessage;
	respStatusCode: number;
	respHeaders: ResponseHeaders;
	private bodyPromise?: Promise<ResponseJSONBody>;

	constructor(resp: IncomingMessage) {
		this.resp = resp;
		this.respStatusCode = resp.statusCode || 400;
		this.respHeaders = resp.headers || {};
	}

	statusCode(): number {
		return this.respStatusCode;
	}

	headers(): ResponseHeaders {
		return this.respHeaders;
	}

	rawResponse(): IncomingMessage {
		return this.resp;
	}

	responseBodyToJSON(): Promise<ResponseJSONBody> {
		this.bodyPromise ??= (async () => {
			let response = '';
			this.resp.setEncoding('utf8');
			for await (const chunk of this.resp) response += chunk;
			return JSON.parse(response);
		})();
		return this.bodyPromise;
	}
}
