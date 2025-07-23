import os from 'os';
import util from 'node:util';
import {EventEmitter} from 'events';

let performChecks = true;

export default class Address extends EventEmitter {
	#props = {
		name: undefined,
		domain: 'local',
		addresses: [],
	};

	published = false;

	_activated = false; // indicates intent - true: starting/started, false: stopping/stopped

	get name() {
		return this.#props.name + (this.#props.name.endsWith('.' + this.domain) ? '' : '.' + this.domain);
	}

	get domain() {
		return this.#props.domain;
	}

	get addresses() {
		return [...this.#props.addresses];
	}

	set addresses(value) {
		this.#props.addresses.splice(0, this.#props.addresses.length, ...value);
	}

	constructor(parts) {
		super(parts);

		if (performChecks) {
			if ( ! parts.name) {
				throw new Error('Required name not given');
			} else if ( ! parts.name.match(/^(?=.{2,255}$)([a-z]([-a-z0-9]{0,61}[a-z0-9])?((?=$)|\.(?!$)))+$/gi)) {
				throw new Error('Invalid name given. Name must be between 2 and 255 characters containing parts seperated by "." characters, each being between 2 and 63 characters in length and matching the regular expression: [a-z]([-a-z0-9]{0,61}[a-z0-9])?');
			}
		}

		this.#populate(parts);
	}

	#populate(parts) {
		Object.entries(parts)
		.forEach(([key, value]) => {
			if (this.#props.hasOwnProperty(key)) {
				this.#props[key] = value;
			}
		});
	}

	static _fromObject(raw) {
		performChecks = false;
		let service = new this(raw);
		performChecks = true;

		return service;
	}

	get [Symbol.toStringTag]() {
		return 'Address';
	}

	toString() {
		return this.name + ' => ' + this.addresses.join(',');
	}

	toObject() {
		return {...this.#props, name: this.name};
	}

	toJSON() {
		return {...this.#props, name: this.name};
	}

	[util.inspect.custom] (depth, options, inspect) {
		if (depth <= 0) {
			return options.stylize('[Address]', 'special');
		}

		return '<' + options.stylize('Address', 'special') + '> ' + inspect({...this.#props, addresses: this.addresses, name: this.name}, {...options, depth: options.depth - 1});
	}

	_records() {
		return Object.values(os.networkInterfaces())
		.flat()
		.filter((address) => {
			return ! address.internal && address.mac !== '00:00:00:00:00:00';
		})
		.map((addr) => {
			return {
				name: this.name,
				type: addr.family === 'IPv4' ? 'A' : 'AAAA',
				ttl: 120,
				data: addr.address,
			};
		});
	}
}
