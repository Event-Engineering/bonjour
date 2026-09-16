import Registry from './lib/registry.js';
import Server from './lib/mdns-server.js';
import Browser from './lib/browser.js';
import { EventEmitter } from 'events';
export { default as Service } from './lib/service.js';
export { default as Address } from './lib/address.js';
export { Registry, Server, Browser };

export default class Bonjour extends EventEmitter {
	#server;
	#registry;

	constructor(opts) {
		super();

		this.#server = new Server(opts);
		this.#registry = new Registry(this.#server);

		this.#server.on('error', (error) => {
			// the server has warned already, so only pass it on where it is wanted
			if (this.listenerCount('error')) {
				this.emit('error', error);
			}
		});
	}

	publishService(opts) {
		return this.#registry.publishService(opts);
	}

	publishAddress(opts) {
		return this.#registry.publishAddress(opts);
	}

	isPublished(resource) {
		return this.#registry.isPublished(resource);
	}

	unpublish(resource, cb) {
		return this.#registry.unpublish(resource, cb);
	}

	unpublishAll(cb) {
		return this.#registry.unpublishAll(cb);
	}

	find(opts, onup, ondown) {
		return new Browser(this.#server.mdns, opts, onup, ondown);
	}

	findOne(opts, cb) {
		let browser = new Browser(this.#server.mdns, opts);
		browser.once('up', function(service) {
			browser.stop();
			if (cb) {
				cb(service);
			}
		});
		return browser;
	}

	destroy() {
		this.#registry.destroy();
		this.#server.mdns.destroy();
	}
}
