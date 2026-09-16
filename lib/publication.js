import report from './helpers/report.js';

/**
 * One resource published by one registry. Internal to the registry.
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
	}

	get [Symbol.toStringTag]() {
		return 'Publication';
	}

	get fqdn() {
		return this.resource.fqdn;
	}

	toString() {
		return this.resource.toString();
	}

	_records() {
		return this.resource._records();
	}

	/**
	 * Events belong to the resource, but a listener needs to know which of its
	 * publications is talking - so every one of them names the registry.
	 */
	emit(event, ...args) {
		return this.resource.emit(event, ...args, this.registry);
	}

	listenerCount(event) {
		return this.resource.listenerCount(event);
	}

	// the resource is what went wrong; the registry is whose publication it was
	report(message, error) {
		return report(this, message + ' ' + this.resource, error);
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
}
