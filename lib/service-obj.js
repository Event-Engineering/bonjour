import util from 'node:util';
import DnsTxt from 'dns-txt';
let dnsTxt = DnsTxt();

export default class ServiceObj {
	#props = {
		name: undefined,
		protocol: 'tcp',
		domain: 'local',
		type: undefined,
		target: undefined,
		port: undefined,
		txt: undefined,
		rawTxt: undefined,
		addresses: [],
	};

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

	get fqdn() {
		return [this.name, '_' + this.type, '_' + this.protocol, this.domain]
		.filter(p => p)
		.join('.');
	}

	get target() {
		return this.#props.target;
	}

	get host() {
		return this.#props.target;
	}

	get port() {
		return this.#props.port;
	}

	get txt() {
		return this.#props.txt;
	}

	set txt(value) {
		rawTxt = dnsTxt.encode(value);
		txt = value;
	}

	get rawTxt() {
		return this.#props.rawTxt;
	}

	set rawTxt(value) {
		rawTxt = value;
		txt = dnsTxt.decode(value);
	}

	get addresses() {
		return [...this.#props.addresses];
	}

	set addresses(value) {
		this.#props.addresses.splice(0, this.#props.addresses.length, ...value);
	}

	constructor(parts) {
		this.#populate(parts);
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

		return new ServiceObj({
			name,
			protocol,
			domain,
			type,
			...otherParts,
		});
	}

	toJSON() {
		return JSON.stringify(this.#props);
	}

	[util.inspect.custom] (depth, options, inspect) {
		if (depth <= 0) {
			return options.stylize('[Service]', 'special');
		}

		return '<' + options.stylize('Service', 'special') + '> ' + inspect({...this.#props, addresses: this.addresses}, {...options, depth: options.depth - 1});
	}
}
