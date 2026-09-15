import report from './helpers/report.js';

/**
 * Anything the publication does not answer for itself belongs to the resource.
 *
 * Reads and writes are made against the resource rather than the proxy, as its
 * getters reach for private fields and would not find them on anything else.
 */
const FACADE = {
	get(publication, property) {
		return property in publication ? Reflect.get(publication, property, publication) : publication.resource[property];
	},

	set(publication, property, value) {
		let target = property in publication ? publication : publication.resource;

		target[property] = value;

		return true;
	},

	has(publication, property) {
		return property in publication || property in publication.resource;
	},

	// a publication of a service is still, to anyone holding it, a service
	getPrototypeOf(publication) {
		return Object.getPrototypeOf(publication.resource);
	},
};

/**
 * One resource published by one registry.
 *
 * Everything that is true of a publication rather than of the resource itself
 * lives here, so that the same service can be published to several registries
 * at once without them treading on each other's state.
 */
export default class Publication {
	resource;
	registry;
	published = false;

	_activated = false;
	_destroyed = false;
	_lastRecords = null;
	_announceTimer = null;
	_updateScheduled = false;
	_onRecordsChanged = null;

	constructor(registry, resource) {
		this.registry = registry;
		this.resource = resource;

		return new Proxy(this, FACADE);
	}

	get [Symbol.toStringTag]() {
		return 'Publication';
	}

	toString() {
		return this.resource.toString();
	}

	start() {
		return this.registry._start(this);
	}

	stop(cb) {
		return this.registry._stop(this, cb);
	}

	get fqdn() {
		return this.resource.fqdn;
	}

	_records() {
		return this.resource._records();
	}

	/**
	 * Events belong to the resource, but a listener needs to know which of its
	 * publications is talking - so every one of them arrives tagged with this.
	 */
	emit(event, ...args) {
		return this.resource.emit(event, ...args, this);
	}

	on(event, listener) {
		this.resource.on(event, listener);

		return this;
	}

	once(event, listener) {
		this.resource.once(event, listener);

		return this;
	}

	off(event, listener) {
		this.resource.off(event, listener);

		return this;
	}

	listenerCount(event) {
		return this.resource.listenerCount(event);
	}

	// the resource is what went wrong; the publication is which one of them it was
	report(message, error) {
		return report(this, message + ' ' + this, error);
	}

	// listen to the resource on the registry's behalf, and stop when asked
	_watch(onRecordsChanged) {
		this._onRecordsChanged = onRecordsChanged;
		this.resource.on('records-changed', onRecordsChanged);
	}

	_unwatch() {
		if (this._onRecordsChanged) {
			this.resource.off('records-changed', this._onRecordsChanged);
			this._onRecordsChanged = null;
		}
	}

	toObject() {
		return this.resource.toObject();
	}

	toJSON() {
		return this.toObject();
	}
}
