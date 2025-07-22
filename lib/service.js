import os from 'os';
import util from 'node:util';
import DnsTxt from './dns-txt.js';
import {EventEmitter} from 'events';

let performChecks = true;

export default class Service extends EventEmitter {
	#dnsTxt;

	#props = {
		name: undefined,
		protocol: 'tcp',
		domain: 'local',
		type: undefined,
		target: '',
		port: undefined,
		txt: undefined,
		txtObj: undefined,
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
		return ['_' + this.type, '_' + this.protocol, this.domain]
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
		this.#props.txt = Array.isArray(value) ? value : [value];
		this.#props.rawTxt = this.#props.txt.map(v => this.#dnsTxt.encode(v));
		this.#props.txtObj = Object.assign({}, ...this.#props.txt);
	}

	get rawTxt() {
		return this.#props.rawTxt;
	}

	set rawTxt(value) {
		this.#props.rawTxt = Array.isArray(value) ? value : [value];
		this.#props.txt = this.#props.rawTxt.map(v => this.#dnsTxt.decode(v));
		this.#props.txtObj = Object.assign({}, ...this.#props.txt);
	}

	get txtObj() {
		return this.#props.txtObj;
	}

	set txtObj(value) {
		this.#props.txtObj = value;
		this.#props.txt = Object.entries(this.#props.txtObj).map(([k, v]) => ({[k]: v}));
		this.#props.rawTxt = this.#props.txt.map(v => this.#dnsTxt.encode(v));
	}

	get referer() {
		return this.#props.referer;
	}

	get addresses() {
		return [...this.#props.addresses];
	}

	set addresses(value) {
		this.#props.addresses.splice(0, this.#props.addresses.length, ...value);
	}

	get #rrPtrService() {
		return {
			name: '_services._dns-sd._udp.' + this.domain,
			type: 'PTR',
			ttl: 28800, // 8 hours
			data: this.dn,
		};
	}

	get #rrPtr() {
		return {
			name: this.dn,
			type: 'PTR',
			ttl: 28800,
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
			data: this.#dnsTxt.encode(this.txt),
		};
	}

	constructor(parts) {
		super(parts);

		if (performChecks) {
			if ( ! parts.name) {
				throw new Error('Required name not given');
			} else if ( ! parts.name.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
				throw new Error('Invalid name given. Name must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
			}

			if ( ! parts.type) {
				throw new Error('Required type not given');
			} else if ( ! parts.type.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
				throw new Error('Invalid type given. type must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
			}

			if ( ! parts.port && parts.port !== 0) {
				throw new Error('Required port not given');
			} else if (parts.port < 0 || parts.port > 65535) {
				throw new Error('Invalid port. Port number must be between 0 and 65535 (16-bit)');
			}

			if ( ! parts.host) {
				parts.host = os.hostname();
			}
		}

		this.#populate(parts);

		this.#dnsTxt = new DnsTxt(parts.txtSettings);
	}

	#populate(parts) {
		Object.entries(parts)
		.forEach(([key, value]) => {
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
		let [name, ...parts] = string.split('._');
		let [protocol, ...domainParts] = parts.pop().split('.');
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
		return {fqdn: this.fqdn, ...this.#props, host: this.host};
	}

	toJSON() {
		return {fqdn: this.fqdn, ...this.#props, host: this.host};
	}

	[util.inspect.custom] (depth, options, inspect) {
		if (depth <= 0) {
			return options.stylize('[Service]', 'special');
		}

		return '<' + options.stylize('Service', 'special') + '> ' + inspect({fqdn: this.fqdn, ...this.#props, addresses: this.addresses, host: this.host}, {...options, depth: options.depth - 1});
	}

	_records() {
		let addressRecords = Object.values(os.networkInterfaces())
		.flat()
		.filter((address) => {
			return ! address.internal && address.mac !== '00:00:00:00:00:00';
		})
		.map((addr) => {
			return {
				name: this.host,
				type: addr.family === 'IPv4' ? 'A' : 'AAAA',
				ttl: 120,
				data: addr.address,
			};
		});

		return [this.#rrPtrService, this.#rrPtr, this.#rrSrv, this.#rrTxt, ...addressRecords];
	}
}

const serviceQuery = Service._fromObject({name: '_services', type: 'dns-sd', protocol: 'udp'});
Object.freeze(serviceQuery);

export {serviceQuery};
