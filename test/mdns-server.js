import dgram from 'dgram';
import tape from 'tape';
import { Server } from '../index.js';

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
			fn(new Server({ ip: '127.0.0.1', port: p, multicast: false }), t);
		});
	});
}

function query(server) {
	server.register({ name: 'foo._http._tcp.local', type: 'PTR', ttl: 4500, data: 'bar._http._tcp.local' });
	server._respondToQuery({ questions: [{ name: 'foo._http._tcp.local', type: 'PTR' }]});
}

test('a response that cannot be sent is reported, not thrown', (server, t) => {
	let warnings = [];
	let errors = [];
	let warn = console.warn;

	console.warn = message => warnings.push(message);
	server.on('error', error => errors.push(error));
	server.mdns.respond = (packet, cb) => cb(new Error('ENETUNREACH'));

	t.doesNotThrow(() => {
		query(server);
	}, 'The host process is left standing');

	console.warn = warn;

	t.equal(warnings.length, 1, 'The querier going unanswered is warned about');
	t.equal(errors.length, 1, 'And the error is emitted for anyone listening');
	t.equal(errors[0].message, 'ENETUNREACH', 'As the error itself');

	server.mdns.destroy();
	t.end();
});

test('a response that cannot be sent does not throw with nobody listening', (server, t) => {
	let warnings = [];
	let warn = console.warn;

	console.warn = message => warnings.push(message);
	server.mdns.respond = (packet, cb) => cb(new Error('EHOSTUNREACH'));

	t.doesNotThrow(() => {
		query(server);
	}, 'An unheard error event would have thrown');

	console.warn = warn;

	t.equal(warnings.length, 1, 'The warning stands in for it');

	server.mdns.destroy();
	t.end();
});
