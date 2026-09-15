import dgram from 'dgram';
import tape from 'tape';
import { Registry, Server } from '../index.js';

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
