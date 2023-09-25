export {default as Registry} from './lib/registry.js';
export {default as Server} from './lib/mdns-server.js';
export {default as Browser} from './lib/browser.js';
export {default as Service} from './lib/service.js';

export default class Bonjour {
	#server;
	#registry;

	constructor(opts) {
		this.#server = new Server(opts);
		this.#registry = new Registry(this.#server);
	}

	publish(opts) {
		return this.#registry.publish(opts);
	}

	unpublishAll(cb) {
		this.#registry.unpublishAll(cb);
	}

	find(opts, onup) {
		return new Browser(this.#server.mdns, opts, onup);
	}

	findOne(opts, cb) {
		let browser = new Browser(this.#server.mdns, opts);
		browser.once('up', function (service) {
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
