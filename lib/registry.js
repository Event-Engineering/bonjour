import { isDeepStrictEqual } from 'util';
import dnsEqual from './helpers/dns-equal.js';
import Service from './service.js';
import Address from './address.js';
import Publication from './publication.js';

const REANNOUNCE_FACTOR = 3;
const REANNOUNCE_TIMES = 3;

// Records owned by a single responder carry the cache-flush bit, so receivers
// replace the whole rrset rather than merging our announcement into what they
// already hold. Shared rrsets (PTR) must not, as several responders contribute
// to them. See RFC-6762 section 10.2.
const UNIQUE_RECORD_TYPES = [ 'A', 'AAAA', 'SRV', 'TXT' ];

export default class Registry {
	_server;

	#publications = new Map();

	constructor(server) {
		this._server = server;
	}

	publish(resource, probe = false) {
		if (! (resource instanceof Service) && ! (resource instanceof Address)) {
			return resource;
		}

		let publication = this.#publications.get(resource) || new Publication(this, resource);

		setTimeout(() => {
			this.#start(publication, probe);
		});

		return resource;
	}

	publishService(opts) {
		return this.publish(opts instanceof Service ? opts : new Service(opts), opts.probe !== false);
	}

	publishAddress(opts) {
		return this.publish(opts instanceof Address ? opts : new Address(opts), opts.probe !== false);
	}

	// is this resource published by us? another registry may answer differently
	isPublished(resource) {
		return !! this.#publications.get(resource)?.published;
	}

	unpublish(resource, cb) {
		let publication = this.#publications.get(resource);

		if (! publication) {
			return Promise.resolve(cb && cb instanceof Function ? cb() : null);
		}

		return this.#stop(publication, cb);
	}

	unpublishAll(cb) {
		let publications = [ ...this.#publications.values() ];

		return this.#teardown(publications)
		.then(() => {
			publications.forEach(publication => this.#release(publication));

			if (cb instanceof Function) {
				return cb();
			}
		});
	}

	destroy() {
		this.#publications.forEach((publication) => {
			publication._destroyed = true;
			clearTimeout(publication._announceTimer);
			this.#release(publication);
		});
	}

	// forget a publication, and stop listening to the resource on its behalf
	#release(publication) {
		this.#publications.delete(publication.resource);
		publication._unwatch();
	}

	#start(publication, probe = false) {
		if (publication._activated) {
			return;
		}

		publication._activated = true;
		this.#publications.set(publication.resource, publication);

		if (! publication._onRecordsChanged) {
			publication._watch(this.#scheduleUpdate.bind(this, publication));
		}

		if (probe && publication.resource instanceof Service) {
			this.#probe(publication)
			.then((exists) => {
				if (exists) {
					this.#stop(publication);
					publication.report('Could not publish', new Error('The service name is already in use on the network'));
					return;
				}
				this.#announce(publication);
			});
		} else {
			this.#announce(publication);
		}
	}

	#stop(publication, cb) {
		if (! publication._activated) {
			// nothing to take down, but the caller is still owed their callback
			return Promise.resolve(cb && cb instanceof Function ? cb() : null);
		}

		return this.#teardown(publication)
		.then(() => {
			this.#release(publication);

			if (cb instanceof Function) {
				return cb();
			}
		});
	}

	/**
	 * The records to publish for a thing, with the cache-flush bit set on the
	 * ones this responder owns outright.
	 */
	#records(publication) {
		return publication._records()
		.map((record) => {
			return { ...record, flush: UNIQUE_RECORD_TYPES.includes(record.type) };
		});
	}

	/**
	 * Queue a re-announcement after a thing's records have changed.
	 *
	 * Coalesced onto the next tick, so that several changes in a row cost one
	 * announcement rather than one each.
	 */
	#scheduleUpdate(publication) {
		if (publication._updateScheduled) {
			return;
		}

		publication._updateScheduled = true;

		setTimeout(() => {
			publication._updateScheduled = false;

			if (publication._activated && ! publication._destroyed) {
				this.#update(publication);
			}
		});
	}

	/**
	 * Re-announce a thing whose records have changed.
	 *
	 * Records that have gone away are sent as goodbyes first: the cache-flush
	 * bit replaces an rrset we still publish, but says nothing about one we
	 * have stopped publishing entirely.
	 */
	#update(publication) {
		let previous = publication._lastRecords || [];
		let records = this.#records(publication);

		let removed = previous.filter((record) => {
			return ! records.some((r) => {
				return r.type === record.type && dnsEqual(r.name, record.name) && isDeepStrictEqual(r.data, record.data);
			});
		});

		if (removed.length) {
			this._server.unregister(removed);
			this._server.mdns.respond(removed.map((record) => {
				return { ...record, ttl: 0, flush: false };
			}), (err) => {
				if (err) {
					publication.report('Could not withdraw the old records for', err);
				}
			});
		}

		this.#announce(publication);
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
	#probe(publication) {
		let { promise, resolve } = Promise.withResolvers();

		let sent = false;
		let retries = 0;
		let timer;
		let send = () => {
			// abort if the service have or is being stopped in the meantime
			if (! publication._activated || publication._destroyed) {
				return;
			}

			this._server.mdns.query(publication.fqdn, 'ANY', (err) => {
				if (err) {
					// a probe nobody heard cannot tell us the name is free, but we retry and then take our chances
					publication.report('Could not probe for', err);
				}

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
			if (! sent) {
				return;
			}

			if (packet.answers.some(matchRR) || packet.additionals.some(matchRR)) {
				done(true);
			}
		};
		let done = (exists) => {
			this._server.mdns.removeListener('response', onResponse);
			clearTimeout(timer);
			resolve(!! exists);
		};
		let matchRR = rr => dnsEqual(rr.name, publication.fqdn);

		this._server.mdns.on('response', onResponse);
		setTimeout(send, Math.random() * 250);

		return promise;
	}

	/**
	 * Initial thing announcement
	 *
	 * Used to announce new services/addresses when they are first registered.
	 *
	 * Broadcasts right away, then again 3 and 9 seconds later. The repetition
	 * guards against packet loss rather than keeping the records alive - a
	 * querier that still cares re-queries as the TTL runs down, and we answer.
	 */
	#announce(publication, count = 1) {
		let packet = this.#records(publication);

		clearTimeout(publication._announceTimer);

		publication._lastRecords = packet;
		this._server.register(packet);

		// abort if the resource have or is being stopped in the meantime
		if (! publication._activated || publication._destroyed || count > REANNOUNCE_TIMES) {
			return;
		}

		publication.emit('announcing', JSON.parse(JSON.stringify(packet)));

		this._server.mdns.respond(packet, (err) => {
			if (err) {
				publication.report('Could not announce', err);
			} else if (! publication.published) {
				publication._activated = true;
				publication.published = true;
				publication.emit('up');
			}

			if (! publication._destroyed) {
				publication._announceTimer = setTimeout(this.#announce.bind(this, publication, count + 1), count * REANNOUNCE_FACTOR * 1000);
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
	#teardown(publications) {
		if (! Array.isArray(publications)) {
			publications = [ publications ];
		}

		publications = publications.filter(publication => publication._activated); // ignore those not currently starting or started

		let records = publications.map((publication) => {
			publication._activated = false;
			clearTimeout(publication._announceTimer);

			// Say goodbye to what was actually announced rather than to whatever
			// the resource would generate now: its addresses, or the host's network
			// interfaces, may have changed since it went up.
			let records = (publication._lastRecords || this.#records(publication))
			.map((record) => {
				return { ...record, ttl: 0, flush: false }; // prepare goodbye message
			});

			publication._lastRecords = null;

			return records;
		})
		.flat(1);

		if (records.length === 0) {
			return Promise.resolve();
		}

		this._server.unregister(records);

		let { promise, resolve } = Promise.withResolvers();

		// send goodbye message
		this._server.mdns.respond(records, (err) => {
			publications.forEach((publication) => {
				if (err) {
					publication.report('Could not say goodbye for', err);
				}

				publication.published = false;
			});

			resolve();
		});

		return promise;
	}
}
