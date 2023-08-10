import multicastdns from 'multicast-dns';
import dnsEqual from 'dns-equal';
import flatten from 'array-flatten';
import deepEqual from 'deep-equal';

export default class Server() {
	mdns;
	registry = {};

	constructor(opts) {
		this.mdns = multicastdns(opts);
		this.mdns.setMaxListeners(0);
		this.mdns.on('query', this._respondToQuery.bind(this));
	}

	register(records) {
		if ( ! Array.isArray(records)) {
			records = [records];
		}

		records.forEach((record) => {
			if ( ! this.registry.hasOwnProperty(record.type)) {
				this.registry[record.type] = [];
			} else if (this.registry[record.type].some(this.#isDuplicateRecord.bind(this, record))) {
				return;
			}

			this.registry[record.type].push(record);
		});
	}

	unregister(records) {
		if ( ! Array.isArray(records)) {
			records = [records];
		}

		records.forEach((record) => {
			if ( ! this.registry.hasOwnProperty(record.type)) {
				return;
			}

			let registry = this.registry[record.type];
			let index;

			while ((index = registry.findIndex(r => r.name === record.name)) > -1) {
				registry.splice(index, 1);
			}
		});
	}

	_respondToQuery(query) {
		query.questions.forEach((question) => {
			let type = question.type;
			let name = question.name;

			// generate the answers section
			let answers = type === 'ANY';
			? flatten.depth(Object.keys(this.registry).map(this._recordsFor.bind(this, name)), 1)
			: this._recordsFor(name, type)

			if (answers.length === 0) {
				return;
			}

			// generate the additionals section
			let additionals = [];

			if (type !== 'ANY') {
				answers.forEach((answer) => {
					if (answer.type !== 'PTR') {
						return;
					}

					additionals = additionals
					.concat(this._recordsFor(answer.data, 'SRV'))
					.concat(this._recordsFor(answer.data, 'TXT'));
				});

				// to populate the A and AAAA records, we need to get a set of unique
				// targets from the SRV record
				additionals
				.filter((record) => {
					return record.type === 'SRV';
				})
				.map((record) => {
					return record.data.target;
				})
				.reduce(this.#unique.bind(this), [])
				.forEach((target) => {
					additionals = additionals
					.concat(this._recordsFor(target, 'A'))
					.concat(this._recordsFor(target, 'AAAA'));
				});
			}

			this.mdns.respond({ answers: answers, additionals: additionals }, (err) => {
				if (err) {
					throw err; // TODO: Handle this (if no callback is given, the error will be ignored)
				}
			});
		});
	}

	_recordsFor(name, type) {
		if ( ! this.registry.hasOwnProperty(type)) {
			return [];
		}

		return this.registry[type]
		.filter((record) => {
			let _name = name.indexOf('.') === -1 ? record.name : record.name.split('.')[0];
			return dnsEqual(_name, name);
		});
	}

	#isDuplicateRecord(a, b) {
		return a.type === b.type && a.name === b.name && deepEqual(a.data, b.data);
	}

	#unique(set, obj) {
		if (set.indexOf(obj) === -1) {
			set.push(obj);
		}

		return set;
	}
}
