/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { Socket } from 'net';
import * as h from './types/httpsServer';

export default class Httpserver implements h.HttpserverClass {
	sockets: Set<Socket>;
	server: Server;
	listening = false;

	constructor(
		port: number,
		cb: (req: IncomingMessage, res: ServerResponse) => any,
	) {
		this.sockets = new Set();
		this.server = createServer(cb).listen(port);
		this.listening = this.server.listening;
		this.server.on('listening', () => {
			this.listening = true;
		});
		this.server.on('close', () => {
			this.listening = false;
		});

		this.server.on('connection', (socket: Socket) => {
			this.sockets.add(socket);

			socket.once('close', () => {
				this.sockets.delete(socket);
			});
		});
	}

	public isListening() {
		return this.server.listening;
	}

	public close(cb?: (err?: Error) => any) {
		for (const socket of this.sockets) {
			socket.destroy();
			this.sockets.delete(socket);
		}

		this.server.close(cb);
	}
}
