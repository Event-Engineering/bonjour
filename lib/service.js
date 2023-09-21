'use strict'

import os from 'os';
import util from 'util';
import {EventEmitter} from 'events';
import serviceName from 'multicast-dns-service-types';
import DnsTxt from 'dns-txt';
let dnsTxt = DnsTxt();

const TLD = '.local';

util.inherits(Service, EventEmitter);

export default class Service {
	name;
	protocol;
	type;
	host;
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

	constructor() {
		if ( ! opts.name) {
			throw new Error('Required name not given');
		}

		if ( ! opts.type) {
			throw new Error('Required type not given');
		}

		if ( ! opts.port) {
			throw new Error('Required port not given');
		}

		this.name = opts.name;
		this.protocol = opts.protocol || 'tcp';
		this.type = serviceName.stringify(opts.type, this.protocol);
		this.host = opts.host || os.hostname();
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
