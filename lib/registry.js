import dnsEqual from 'dns-equal';
import Service from './service';

const REANNOUNCE_MAX_MS = 60 * 60 * 1000;
const REANNOUNCE_FACTOR = 3;

export default class Registry {
	_server;
	_services = [];
	#service;

	constructor(server) {
		this._server = server;
	}

	publish(opts) {
		this.#service = new Service(opts);
		// service.start = this.#start.bind(this);
		// this.#service.stop = stop.bind(this);
		this.#start({ probe: opts.probe !== false });
		return service;
	}

	unpublishAll(cb) {
		teardown(this._services, cb);
		this._services = [];
	}

	destroy() {
		this._services.forEach((service) => {
			service._destroyed = true;
		});
	}

	#start(opts) {
		if (this.#service._activated) {
			return;
		}

		this.#service._activated = true;
		this._services.push(this);

		if (opts.probe) {
			this.#probe(this._server.mdns, (exists) => {
				if (exists) {
					this.#stop();
					this.#service.emit('error', new Error('Service name is already in use on the network'));
					return
				}
				this.#announce(this._server, this.#service);
			});
		} else {
			this.#announce(this._server);
		}
	}

	#stop(cb) {
		if ( ! this.#service._activated) {
			return; // TODO: What about the callback?
		}

		this.#teardown(this.#service, cb);

		let index = this._services.indexOf(this.#service);
		if (index !== -1) {
			this._services.splice(index, 1);
		}

		this.#service = null;
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
	#probe(mdns, cb) {
		let sent = false;
		let retries = 0;
		let timer;
		let send = () => {
			// abort if the service have or is being stopped in the meantime
			if ( ! this.#service._activated || this.#service._destroyed) {
				return;
			}

			mdns.query(this.#service.fqdn, 'ANY', () => {
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
			mdns.removeListener('response', onResponse);
			clearTimeout(timer);
			cb( !! exists);
		};
		let matchRR = (rr) => dnsEqual(rr.name, this.#service.fqdn);

		mdns.on('response', onResponse);
		setTimeout(send, Math.random() * 250);
	}

	/**
	 * Initial service announcement
	 *
	 * Used to announce new services when they are first registered.
	 *
	 * Broadcasts right away, then after 3 seconds, 9 seconds, 27 seconds,
	 * and so on, up to a maximum interval of one hour.
	 */
	#announce() {
		let delay = 1000;
		let packet = this.#service._records();

		this._server.register(packet);

		let broadcast = () => {
			// abort if the service have or is being stopped in the meantime
			if ( ! this.#service._activated || this.#service._destroyed) {
				return;
			}

			this._server.mdns.respond(packet, () => {
				// This function will optionally be called with an error object. We'll
				// just silently ignore it and retry as we normally would
				if ( ! this.#service.published) {
					this.#service._activated = true;
					this.#service.published = true;
					this.#service.emit('up');
				}

				delay = Math.min(delay * REANNOUNCE_FACTOR, REANNOUNCE_MAX_MS);

				if ( ! this.#service._destroyed) {
					setTimeout(broadcast, delay).unref();
				}
			});
		};

		broadcast();
	}

	/**
	 * Stop the given services
	 *
	 * Besides removing a service from the mDNS registry, a "goodbye"
	 * message is sent for each service to let the network know about the
	 * shutdown.
	 */
	#teardown(services, cb) {
		if ( ! Array.isArray(services)) {
			services = [services];
		}

		services = services.filter((service) => service._activated); // ignore services not currently starting or started

		let records = services.map((service) => {
			service._activated = false;
			let records = service._records();

			records.forEach((record) => {
				record.ttl = 0; // prepare goodbye message
			});

			return records;
		})
		.flat(1);

		if (records.length === 0) {
			return cb && cb();
		}

		this._server.unregister(records);

		// send goodbye message
		this._server.mdns.respond(records, (...args) => {
			services.forEach((service) => {
				service.published = false;
			});

			if (cb) {
				cb(...args);
			}
		});
	}
}
