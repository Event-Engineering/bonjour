import dgram from 'dgram';
import tape from 'tape';
import { Registry, Server, Service } from '../index.js';

function port(cb) {
	let s = dgram.createSocket('udp4');
	s.bind(0, () => {
		let port = s.address().port;
		s.on('close', () => {
			cb(port);
		});
		s.close();
	});
}

function test(name, fn) {
	tape(name, (t) => {
		port((p) => {
			let server = new Server({ ip: '127.0.0.1', port: p, multicast: false });
			fn(server, new Registry(server), t);
		});
	});
}

test('one resource published twice keeps the two publications apart', (server, registry, t) => {
	let other = new Registry(server);
	let service = new Service({ name: 'foo', type: 'test', port: 3000 });

	server.mdns.respond = (packet, cb) => cb();

	let here = registry.publish(service, false);
	let there = other.publish(service, false);

	setTimeout(() => {
		t.notEqual(here, there, 'Each registry has its own publication');
		t.equal(here.resource, there.resource, 'Of the one service');
		t.ok(here.published && there.published, 'Both of which went up');

		here.stop(() => {
			t.equal(here.published, false, 'Stopping one takes that one down');
			t.equal(there.published, true, 'And leaves the other standing');

			other.unpublishAll(() => {
				server.mdns.destroy();
				t.end();
			});
		});
	}, 50);
});

function conflict(server) {
	server.mdns.respond = (packet, cb) => cb();
	server.mdns.query = (name, type, cb) => {
		cb();
		server.mdns.emit('response', { answers: [{ name: 'foo._test._tcp.local' }], additionals: []});
	};
}

test('a name already in use is reported, not thrown', (server, registry, t) => {
	let warnings = [];
	let errors = [];
	let warn = console.warn;

	conflict(server);
	console.warn = message => warnings.push(message);

	let publication = registry.publishService({ name: 'foo', type: 'test', port: 3000 });
	publication.on('error', error => errors.push(error));

	setTimeout(() => {
		console.warn = warn;

		t.equal(errors.length, 1, 'The clash reaches whoever is listening');
		t.ok(/already in use/.test(errors[0].message), 'Saying what went wrong');
		t.equal(warnings.length, 1, 'And is warned about');
		t.equal(publication.published, false, 'The service is not published');

		server.mdns.destroy();
		t.end();
	}, 400);
});

test('a name already in use does not throw with nobody listening', (server, registry, t) => {
	let warnings = [];
	let warn = console.warn;

	conflict(server);
	console.warn = message => warnings.push(message);

	registry.publishService({ name: 'foo', type: 'test', port: 3000 });

	setTimeout(() => {
		console.warn = warn;

		t.equal(warnings.length, 1, 'An unheard error event would have taken the process with it');

		server.mdns.destroy();
		t.end();
	}, 400);
});

test('an announcement that cannot be sent is reported', (server, registry, t) => {
	let warnings = [];
	let errors = [];
	let warn = console.warn;

	server.mdns.respond = (packet, cb) => cb(new Error('ENETUNREACH'));
	console.warn = message => warnings.push(message);

	let service = registry.publishService({ name: 'foo', type: 'test', port: 3000, probe: false });
	service.on('error', error => errors.push(error));

	setTimeout(() => {
		console.warn = warn;

		t.equal(errors.length, 1, 'The error reaches the service');
		t.equal(errors[0].message, 'ENETUNREACH', 'As the error itself');
		t.equal(warnings.length, 1, 'And is warned about');
		t.equal(service.published, false, 'A service that never went out is not called up');

		clearTimeout(service._announceTimer);
		server.mdns.destroy();
		t.end();
	}, 100);
});

test('a goodbye that cannot be sent is reported, and still settles', (server, registry, t) => {
	server.mdns.respond = (packet, cb) => cb();

	let service = registry.publishService({ name: 'foo', type: 'test', port: 3000, probe: false });

	service.on('up', () => {
		let warnings = [];
		let errors = [];
		let warn = console.warn;

		console.warn = message => warnings.push(message);
		service.on('error', error => errors.push(error));
		server.mdns.respond = (packet, cb) => cb(new Error('EHOSTUNREACH'));

		registry.unpublishAll(() => {
			console.warn = warn;

			t.equal(errors.length, 1, 'The error reaches the service');
			t.equal(warnings.length, 1, 'And is warned about');
			t.equal(service.published, false, 'The service is marked down regardless');

			server.mdns.destroy();
			t.end();
		});
	});
});
