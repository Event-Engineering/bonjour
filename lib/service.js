import os from 'os';
import util from 'node:util';
import DnsTxt from './dns-txt.js';
import addressRecords from './helpers/addresses.js';
import { EventEmitter } from 'events';

let performChecks = true;

export default class Service extends EventEmitter {
	#dnsTxt;

	// The pairs the live txt proxy wraps, so that a txt we have since replaced
	// can be told apart from the current one.
	#txtTarget;

	#txtHandler = {
		set: (target, key, value) => {
			target[key] = value;
			this.#txtChanged(target);

			return true;
		},
		deleteProperty: (target, key) => {
			delete target[key];
			this.#txtChanged(target);

			return true;
		},
	};

	#props = {
		name: undefined,
		protocol: 'tcp',
		domain: 'local',
		type: undefined,
		target: '',
		port: undefined,
		txt: undefined,
		rawTxt: undefined,
		referer: undefined,
		addresses: [],
	};

	published = false;

	_activated = false; // indicates intent - true: starting/started, false: stopping/stopped

	get name() {
		return this.#props.name;
	}

	get protocol() {
		return this.#props.protocol;
	}

	get domain() {
		return this.#props.domain;
	}

	get type() {
		return this.#props.type;
	}

	get dn() {
		return [ '_' + this.type, '_' + this.protocol, this.domain ]
		.join('.');
	}

	get fqdn() {
		return (this.name ? this.name + '.' : '') + this.dn;
	}

	get target() {
		return this.#props.target + (this.#props.target.endsWith('.' + this.domain) ? '' : '.' + this.domain);
	}

	get host() {
		return this.target;
	}

	get port() {
		return this.#props.port;
	}

	get txt() {
		return this.#props.txt;
	}

	set txt(value) {
		this.#props.txt = this.#txtProxy(value || {});
		this.#txtChanged(this.#txtTarget);
	}

	get rawTxt() {
		return this.#props.rawTxt;
	}

	set rawTxt(value) {
		this.#props.rawTxt = Array.isArray(value) ? value : [ value ];
		this.#props.txt = this.#txtProxy(this.#dnsTxt.decode(this.#props.rawTxt));
		this.emit('records-changed');
	}

	/**
	 * Wrap the decoded pairs so that reaching into them - service.txt.foo =
	 * 'bar' - re-encodes the record, rather than quietly leaving the two
	 * representations disagreeing with each other.
	 */
	#txtProxy(txt) {
		this.#txtTarget = txt;

		return new Proxy(txt, this.#txtHandler);
	}

	/**
	 * Re-encode the record behind a change made through the proxy.
	 *
	 * Someone may still be holding a txt we have since replaced. What they do
	 * with it is their business, but it is no longer ours - encoding it would
	 * leave us publishing a record we do not have.
	 */
	#txtChanged(target) {
		if (target !== this.#txtTarget) {
			return;
		}

		// A pair the encoder will not carry stays in the pairs regardless: it is
		// yours to keep, we simply cannot put it on the wire.
		this.#props.rawTxt = this.#dnsTxt.encode(target);
		this.emit('records-changed');
	}

	get referer() {
		return this.#props.referer;
	}

	get addresses() {
		return [ ...this.#props.addresses ];
	}

	set addresses(value) {
		this.#props.addresses.splice(0, this.#props.addresses.length, ...value);
		this.emit('records-changed');
	}

	get #rrPtrService() {
		return {
			name: '_services._dns-sd._udp.' + this.domain,
			type: 'PTR',
			ttl: 4500, // 75 minutes, per RFC-6762 section 10
			data: this.dn,
		};
	}

	get #rrPtr() {
		return {
			name: this.dn,
			type: 'PTR',
			ttl: 4500,
			data: this.fqdn,
		};
	}

	get #rrSrv() {
		return {
			name: this.fqdn,
			type: 'SRV',
			ttl: 120,
			data: {
				port: this.port,
				target: this.host,
			},
		};
	}

	get #rrTxt() {
		return {
			name: this.fqdn,
			type: 'TXT',
			ttl: 4500,
			data: this.#props.rawTxt || this.#dnsTxt.encode({}),
		};
	}

	constructor(parts) {
		super(parts);

		if (performChecks) {
			if (! parts.name) {
				throw new Error('Required name not given');
			} else if (! parts.name.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
				throw new Error('Invalid name given. Name must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
			}

			if (! parts.type) {
				throw new Error('Required type not given');
			} else if (! parts.type.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
				throw new Error('Invalid type given. type must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
			}

			if (! parts.port && parts.port !== 0) {
				throw new Error('Required port not given');
			} else if (parts.port < 0 || parts.port > 65535) {
				throw new Error('Invalid port. Port number must be between 0 and 65535 (16-bit)');
			}

			if (! parts.host) {
				parts.host = os.hostname();
			}
		}

		this.#populate(parts);

		this.#dnsTxt = new DnsTxt(parts.txtSettings);

		// #populate writes straight to the props, deliberately - it hydrates a
		// service we have found rather than one we are building. Whichever of
		// the two representations it was given, bring the other into step now
		// that there is something to encode with.
		if (this.#props.rawTxt) {
			this.rawTxt = this.#props.rawTxt;
		} else if (this.#props.txt) {
			this.txt = this.#props.txt;
		}
	}

	#populate(parts) {
		Object.entries(parts)
		.forEach(([ key, value ]) => {
			switch (key) {
				case 'host':
					key = 'target';
					break;
			}

			if (this.#props.hasOwnProperty(key)) {
				this.#props[key] = value;
			}
		});
	}

	static fromFqdn(string, otherParts) {
		let [ name, ...parts ] = string.split('._');
		let [ protocol, ...domainParts ] = parts.pop().split('.');
		let domain = domainParts.join('.');
		let type = parts.pop();

		performChecks = false;
		let service = new this({
			name,
			protocol,
			domain,
			type,
			...(otherParts || {}),
		});
		performChecks = true;

		return service;
	}

	/**
	 * Settle a service we have found.
	 *
	 * It describes what was on the network rather than something we publish,
	 * so the proxy has nothing left to keep in step - unwrapping it lets the
	 * freeze reach the pairs themselves, and any reference still held to the
	 * proxy now finds a frozen target underneath.
	 */
	_freeze() {
		this.#props.txt = Object.freeze(this.#txtTarget);
		this.#txtTarget = undefined;

		Object.freeze(this.#props.rawTxt);
		Object.freeze(this.#props.addresses);

		return Object.freeze(this);
	}

	static _fromObject(raw) {
		performChecks = false;
		let service = new this(raw);
		performChecks = true;

		return service;
	}

	get [Symbol.toStringTag]() {
		return 'Service';
	}

	toString() {
		return this.fqdn + ' => ' + this.target + ':' + this.port + ' => ' + this.addresses.join(',');
	}

	toObject() {
		return { fqdn: this.fqdn, ...this.#props, host: this.host };
	}

	toJSON() {
		return { fqdn: this.fqdn, ...this.#props, host: this.host };
	}

	[util.inspect.custom](depth, options, inspect) {
		if (depth <= 0) {
			return options.stylize('[Service]', 'special');
		}

		return '<' + options.stylize('Service', 'special') + '> ' + inspect({ fqdn: this.fqdn, ...this.#props, addresses: this.addresses, host: this.host }, { ...options, depth: options.depth - 1 });
	}

	_records() {
		return [ this.#rrPtrService, this.#rrPtr, this.#rrSrv, this.#rrTxt, ...addressRecords(this.host, this.addresses) ];
	}
}

const serviceQuery = Service._fromObject({ name: '_services', type: 'dns-sd', protocol: 'udp' });
Object.freeze(serviceQuery);

export { serviceQuery };
