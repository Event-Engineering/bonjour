import {EventEmitter} from 'events';
import serviceName from 'multicast-dns-service-types';
import dnsEqual from 'dns-equal';
import dnsTxt from 'dns-txt';

const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;

export default class Browser extends EventEmitter {
	_mdns;
	_onresponse = null;
	_serviceMap = {};
	_txt;
	_name;
	_wildcard = false;
	_services = [];

	constructor(mdns, opts, onup, ondown) {
		super(opts);

		this._mdns = mdns;
		this._txt = dnsTxt(opts.txt);

		if ( ! opts || ! opts.type) {
			this._name = WILDCARD;
			this._wildcard = true;
		} else {
			this._name = serviceName.stringify(opts.type, opts.protocol || 'tcp') + TLD;

			if (opts.name) {
				this._name = opts.name + '.' + this._name;
			}
		}

		if (onup) {
			this.on('up', onup);
		}

		if (ondown) {
			this.on('down', ondown);
		}

		if (opts?.autostart !== false) {
			this.start();
		}
	}

	start() {
		if (this._onresponse) {
			return;
		}

		// List of names for the browser to listen for. In a normal search this will
		// be the primary name stored on the browser. In case of a wildcard search
		// the names will be determined at runtime as responses come in.
		let nameMap = {};
		if ( ! this._wildcard) {
			nameMap[this._name] = true;
		}

		this._onresponse = (packet, rinfo) => {
			if (this._wildcard) {
				packet.answers
				.forEach((answer) => {
					if (answer.type !== 'PTR' || answer.name !== this._name || answer.name in nameMap) {
						return;
					}
					nameMap[answer.data] = true;
					this._mdns.query(answer.data, 'PTR');
				});
			}

			Object.keys(nameMap).forEach((name) => {
				// unregister all services shutting down
				this.#goodbyes(name, packet)
				.forEach(this._removeService.bind(this));

				// register all new services
				let matches = this.#buildServicesFor(name, packet, this._txt, rinfo);

				matches.forEach((service) => {
					if (this._serviceMap[service.fqdn]) {
						return; // ignore already registered services
					}

					this._addService(service);
				});
			});
		}

		this._mdns.on('response', this._onresponse);
		this.update();
	}

	stop() {
		if ( ! this._onresponse) {
			return;
		}

		this._mdns.removeListener('response', this._onresponse);
		this._onresponse = null;
	}

	update() {
		this._mdns.query(this._name, 'PTR');
	}

	_addService(service) {
		this._services.push(service);
		this._serviceMap[service.fqdn] = true;
		this.emit('up', service);
	}

	_removeService(fqdn) {
		let index = this._services.findIndex((s) => {
			return dnsEqual(s.fqdn, fqdn);
		});

		if (index < 0) {
			return;
		}

		let service = this._services.splice(index, 1)[0];
		delete this._serviceMap[fqdn];
		this.emit('down', service);
	}

	// PTR records with a TTL of 0 is considered a "goodbye" announcement. I.e. a
	// DNS response broadcasted when a service shuts down in order to let the
	// network know that the service is no longer going to be available.
	//
	// For more info see:
	// https://tools.ietf.org/html/rfc6762#section-8.4
	//
	// This function returns an array of all resource records considered a goodbye
	// record
	#goodbyes(name, packet) {
		return packet.answers.concat(packet.additionals)
		.filter((rr) => {
			return rr.type === 'PTR' && rr.ttl === 0 && dnsEqual(rr.name, name);
		})
		.map((rr) => {
			return rr.data;
		});
	}

	#buildServicesFor(name, packet, txt, referer) {
		let records = packet.answers.concat(packet.additionals)
		.filter((rr) => {
			return rr.ttl > 0; // ignore goodbye messages
		});

		return records
		.filter((rr) => {
			return rr.type === 'PTR' && dnsEqual(rr.name, name);
		})
		.map((ptr) => {
			let service = {};

			records
			.filter((rr) => {
				return (rr.type === 'SRV' || rr.type === 'TXT') && dnsEqual(rr.name, ptr.data);
			})
			.forEach((rr) => {
				if (rr.type === 'SRV') {
					let fqdn = rr.name;
					let [name, ...parts] = fqdn.split('.');
					let types = serviceName.parse(parts.slice(0, -1).join('.'));

					service.name = name;
					service.fqdn = fqdn;
					service.host = rr.data.target;
					service.referer = referer;
					service.port = rr.data.port;
					service.type = types.name;
					service.protocol = types.protocol;
					service.subtypes = types.subtypes;
				} else if (rr.type === 'TXT') {
					service.rawTxt = rr.data;
					service.txt = txt.decode(rr.data);
				}
			});

			if ( ! service.name) {
				return;
			}

			service.addresses = records
			.filter((rr) => {
				return (rr.type === 'A' || rr.type === 'AAAA') && dnsEqual(rr.name, service.host);
			})
			.map((rr) => rr.data);

			return service;
		})
		.filter((rr) => {
			return !! rr;
		});
	}
}
