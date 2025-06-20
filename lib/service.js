import os from 'os';
import {EventEmitter} from 'events';
import DnsTxt from './dns-txt.js';
let dnsTxt = new DnsTxt();

const TLD = '.local';

export default class Service extends EventEmitter {
	name;
	protocol;
	type;
	#host;
	port;
	subtypes;
	txt;
	published = false;

	_activated = false; // indicates intent - true: starting/started, false: stopping/stopped

	get fqdn() {
		return this.name + '.' + this.type + TLD;
	}

	get #rrPtrService() {
		return {
			name: '_services._dns-sd._udp' + TLD,
			type: 'PTR',
			ttl: 28800, // 8 hours
			data: this.type + TLD,
		};
	}

	get #rrPtr() {
		return {
			name: this.type + TLD,
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
			data: dnsTxt.encode(this.txt),
		};
	}

	get host() {
		return this.#host + (this.#host.endsWith(TLD) ? '' : TLD);
	}

	constructor(opts) {
		if ( ! opts.name) {
			throw new Error('Required name not given');
		} else if ( ! opts.name.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
			throw new Error('Invalid name given. Name must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
		}

		if ( ! opts.type) {
			throw new Error('Required type not given');
		} else if ( ! opts.type.match(/^(?=.{1,15}$)([0-9]-?)?[a-z](-?[a-z0-9])*$/i)) {
			throw new Error('Invalid type given. type must be 15 characters or less, and match the expression: `([0-9]-?)?[a-z](-?[a-z0-9])*`');
		}

		if ( ! opts.port && opts.port !== 0) {
			throw new Error('Required port not given');
		} else if (opts.port < 0 || opts.port > 65535) {
			throw new Error('Invalid port. Port number must be between 0 and 65535 (16-bit)');
		}

		super(opts);

		this.name = opts.name;
		this.protocol = opts.protocol || 'tcp';
		this.type = '_' + opts.type + '._' + this.protocol;
		this.#host = opts.host || os.hostname();
		this.port = opts.port;
		this.subtypes = opts.subtypes || null;
		this.txt = opts.txt || null;
	}

	_records() {
		let addressRecords = Object.values(os.networkInterfaces())
		.flat()
		.map((addr) => {
			if (addr.internal) {
				return;
			}

			if (addr.family === 'IPv4') {
				return this.#rrA(addr.address);
			} else {
				return this.#rrAaaa(addr.address);
			}
		})
		.filter(r => r);

		return [this.#rrPtrService, this.#rrPtr, this.#rrSrv, this.#rrTxt, ...addressRecords];
	}

	#rrA(ip) {
		return {
			name: this.host,
			type: 'A',
			ttl: 120,
			data: ip,
		};
	}

	#rrAaaa(ip) {
		return {
			name: this.host,
			type: 'AAAA',
			ttl: 120,
			data: ip,
		};
	}
}
