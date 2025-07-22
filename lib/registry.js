import dnsEqual from 'dns-equal';
import Service from './service.js';

const REANNOUNCE_MAX_MS = 60 * 60 * 1000;
const REANNOUNCE_FACTOR = 3;
const REANNOUNCE_TIMES = 3;

export default class Registry {
	_server;
	_published = [];

	constructor(server) {
		this._server = server;
	}

	publishService(opts) {
		let service = opts instanceof Service ? opts : new Service(opts);
		service.start = this.#start.bind(this, service);
		service.stop = this.#stop.bind(this, service);

		setTimeout(() => {
			this.#start(service, { probe: opts.probe !== false });
		});

		return service;
	}

	unpublishAll(cb) {
		return this.#teardown(this._published)
		.then(() => {
			this._published = [];

			if (cb instanceof Function) {
				return cb();
			}
		});
	}

	destroy() {
		this._published.forEach((thing) => {
			thing._destroyed = true;
		});
	}

	#start(thing, opts) {
		if (thing._activated) {
			return;
		}

		thing._activated = true;
		this._published.push(thing);

		if (opts.probe && thing instanceof Service) {
			this.#probe(thing)
			.then((exists) => {
				if (exists) {
					this.#stop(thing);
					thing.emit('error', new Error('Service name is already in use on the network'));
					return;
				}
				this.#announce(thing);
			});
		} else {
			this.#announce(thing);
		}
	}

	#stop(thing, cb) {
		if ( ! thing._activated) {
			return; // TODO: What about the callback?
		}

		return this.#teardown(thing)
		.then(() => {
			let index;
			while (~(index = this._published.indexOf(thing))) {
				this._published.splice(index, 1);
			}

			if (cb instanceof Function) {
				return cb();
			}
		});
	}

	/**
	 * Check if a service name is already in use on the network.
	 *
	 * Used before announcing the new service.
	 *
	 * To guard against race conditions where multiple services are started
	 * simultaneously on the network, wait a random amount of time (between
	 * 0 and 250 ms) before probing.
	 *
	 * TODO: Add support for Simultaneous Probe Tiebreaking:
	 * https://tools.ietf.org/html/rfc6762#section-8.2
	 */
	#probe(service) {
		let {promise, resolve} = Promise.withResolvers();

		let sent = false;
		let retries = 0;
		let timer;
		let send = () => {
			// abort if the service have or is being stopped in the meantime
			if ( ! service._activated || service._destroyed) {
				return;
			}

			this._server.mdns.query(service.fqdn, 'ANY', () => {
				// This function will optionally be called with an error object. We'll
				// just silently ignore it and retry as we normally would
				sent = true;
				timer = setTimeout(++retries < 3 ? send : done, 250);
				timer.unref();
			});
		};
		let onResponse = (packet) => {
			// Apparently conflicting Multicast DNS responses received *before*
			// the first probe packet is sent MUST be silently ignored (see
			// discussion of stale probe packets in RFC 6762 Section 8.2,
			// "Simultaneous Probe Tiebreaking" at
			// https://tools.ietf.org/html/rfc6762#section-8.2
			if ( ! sent) {
				return;
			}

			if (packet.answers.some(matchRR) || packet.additionals.some(matchRR)) {
				done(true);
			}
		};
		let done = (exists) => {
			this._server.mdns.removeListener('response', onResponse);
			clearTimeout(timer);
			resolve( !! exists);
		};
		let matchRR = (rr) => dnsEqual(rr.name, service.fqdn);

		this._server.mdns.on('response', onResponse);
		setTimeout(send, Math.random() * 250);

		return promise;
	}

	/**
	 * Initial thing announcement
	 *
	 * Used to announce new services/addresses when they are first registered.
	 *
	 * Broadcasts right away, then after 3 seconds, 9 seconds, 27 seconds,
	 * and so on, up to a maximum interval of one hour.
	 */
	#announce(thing, count = 1) {
		let packet = thing._records();

		this._server.register(packet);

		// abort if the thing have or is being stopped in the meantime
		if ( ! thing._activated || thing._destroyed || count > REANNOUNCE_TIMES) {
			return;
		}

		thing.emit('anouncing', JSON.parse(JSON.stringify(packet)));

		this._server.mdns.respond(packet, () => {
			// This function will optionally be called with an error object. We'll
			// just silently ignore it and retry as we normally would
			if ( ! thing.published) {
				thing._activated = true;
				thing.published = true;
				thing.emit('up');
			}

			if ( ! thing._destroyed) {
				setTimeout(this.#announce.bind(this, thing, count + 1), Math.min(count * REANNOUNCE_FACTOR * 1000, REANNOUNCE_MAX_MS));
			}
		});
	}

	/**
	 * Stop the given services/addresses
	 *
	 * Besides removing a service/address from the mDNS registry, a "goodbye"
	 * message is sent for each service to let the network know about the
	 * shutdown.
	 */
	#teardown(things) {
		if ( ! Array.isArray(things)) {
			things = [things];
		}

		things = things.filter((thing) => thing._activated); // ignore things not currently starting or started

		let records = things.map((thing) => {
			thing._activated = false;
			let records = thing._records();

			records.forEach((record) => {
				record.ttl = 0; // prepare goodbye message
			});

			return records;
		})
		.flat(1);

		if (records.length === 0) {
			return Promise.resolve();
		}

		this._server.unregister(records);

		let {promise, resolve} = Promise.withResolvers();

		// send goodbye message
		this._server.mdns.respond(records, (...args) => {
			things.forEach((thing) => {
				thing.published = false;
			});

			resolve();
		});

		return promise;
	}
}
