import util from 'node:util';
import DnsTxt from 'dns-txt';

export default class ServiceObj {
	#dnsTxt;

	#props = {
		name: undefined,
		protocol: 'tcp',
		domain: 'local',
		type: undefined,
		target: undefined,
		port: undefined,
		txt: undefined,
		rawTxt: undefined,
		referer: undefined,
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
		this.#props.rawTxt = this.#dnsTxt.encode(value);
		this.#props.txt = value;
	}

	get rawTxt() {
		return this.#props.rawTxt;
	}

	set rawTxt(value) {
		this.#props.rawTxt = value;
		this.#props.txt = this.#dnsTxt.decode(value);
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

	constructor(parts) {
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

		return new ServiceObj({
			name,
			protocol,
			domain,
			type,
			...(otherParts || {}),
		});
	}

	toJSON() {
		return JSON.stringify({fqdn: this.fqdn, ...this.#props, host: this.host});
	}

	[util.inspect.custom] (depth, options, inspect) {
		if (depth <= 0) {
			return options.stylize('[Service]', 'special');
		}

		return '<' + options.stylize('Service', 'special') + '> ' + inspect({fqdn: this.fqdn, ...this.#props, addresses: this.addresses, host: this.host}, {...options, depth: options.depth - 1});
	}
}

const serviceQuery = new ServiceObj({name: '_services', type: 'dns-sd', protocol: 'udp'});
Object.freeze(serviceQuery);

export {serviceQuery};
