import os from 'os';
import dgram from 'dgram';
import tape from 'tape';
import afterAll from 'after-all';
import { default as Bonjour, Service } from '../index.js';

function getAddresses() {
	let addresses = [];
	let itrs = os.networkInterfaces();
	for (let i in itrs) {
		let addrs = itrs[i];
		for (let j in addrs) {
			if (addrs[j].internal === false) {
				addresses.push(addrs[j].address);
			}
		}
	}
	return addresses;
}

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
			fn(new Bonjour({ ip: '127.0.0.1', port: p, multicast: false }), t);
		});
	});
}

test('bonjour.publish', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'foo', type: 'bar', port: 3000 });
	t.ok(service instanceof Service, 'Publishing hands back the service itself');
	t.equal(bonjour.isPublished(service), false);
	service.on('up', () => {
		t.equal(bonjour.isPublished(service), true);
		bonjour.destroy();
		t.end();
	});
});

test('bonjour.unpublishAll', (bonjour, t) => {
	t.test('published services', (t) => {
		let service = bonjour.publishService({ name: 'foo', type: 'bar', port: 3000 });
		service.on('up', () => {
			bonjour.unpublishAll((err) => {
				t.error(err);
				t.equal(bonjour.isPublished(service), false);
				bonjour.destroy();
				t.end();
			});
		});
	});

	t.test('no published services', (t) => {
		bonjour.unpublishAll((err) => {
			t.error(err);
			t.end();
		});
	});
});

test('bonjour.unpublishAll - settles once the goodbyes have gone', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'foo', type: 'bar', port: 3000 });

	service.on('up', async() => {
		await bonjour.unpublishAll();

		t.equal(bonjour.isPublished(service), false, 'Awaiting it waits for the service to go down');
		bonjour.destroy();
		t.end();
	});
});

test('bonjour.destroy - stops the announcement timer', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'foo', type: 'bar', port: 3000 });

	service.on('up', () => {
		// the next announcement is scheduled once this event has been dealt with
		setTimeout(() => {
			let timers = () => process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
			let before = timers();

			bonjour.destroy();

			t.equal(timers(), before - 1, 'The pending re-announcement is cleared');
			t.end();
		});
	});
});

test('bonjour.find', (bonjour, t) => {
	let next = afterAll(() => {
		let browser = bonjour.find({ type: 'test' });
		let ups = 0;

		browser.on('up', (s) => {
			if (s.name === 'Foo-Bar') {
				t.equal(s.name, 'Foo-Bar');
				t.equal(s.fqdn, 'Foo-Bar._test._tcp.local');
				t.deepEqual(s.txt, {});
				t.deepEqual(s.rawTxt, [ Buffer.alloc(0) ]);
			} else {
				t.equal(s.name, 'Baz');
				t.equal(s.fqdn, 'Baz._test._tcp.local');
				t.deepEqual(s.txt, { foo: 'bar' });
				t.deepEqual(s.rawTxt, [ Buffer.from('foo=bar') ]);
			}

			t.equal(s.host, os.hostname() + '.local');
			t.equal(s.port, 3000);
			t.equal(s.type, 'test');
			t.equal(s.protocol, 'tcp');
			t.equal(s.referer.address, '127.0.0.1');
			t.equal(s.referer.family, 'IPv4');
			t.ok(Number.isFinite(s.referer.port));
			t.ok(Number.isFinite(s.referer.size));
			// t.deepEqual(s.subtypes, []);
			t.deepEqual(s.addresses.sort(), getAddresses().sort());

			if (++ups === 2) {
				// use timeout in an attempt to make sure the invalid record doesn't
				// bubble up
				setTimeout(() => {
					bonjour.destroy();
					t.end();
				}, 50);
			}
		});
	});

	bonjour.publishService({ name: 'Foo-Bar', type: 'test', port: 3000 }).on('up', next());
	bonjour.publishService({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next());
	bonjour.publishService({ name: 'Baz', type: 'test', port: 3000, txt: { foo: 'bar' }}).on('up', next());
});

test('bonjour.find - binary txt', (bonjour, t) => {
	let next = afterAll(() => {
		let browser = bonjour.find({ type: 'test', txt: { binary: true }});

		browser.on('up', (s) => {
			t.equal(s.name, 'Foo');
			t.deepEqual(s.txt, { bar: Buffer.from('buz') });
			t.deepEqual(s.rawTxt, [ Buffer.from('bar=buz') ]);
			bonjour.destroy();
			t.end();
		});
	});

	bonjour.publishService({ name: 'Foo', type: 'test', port: 3000, txt: { bar: Buffer.from('buz') }}).on('up', next());
});

test('bonjour.find - down event', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'Foo-Bar', type: 'test', port: 3000 });

	service.on('up', () => {
		let browser = bonjour.find({ type: 'test' });

		browser.on('up', (s) => {
			t.equal(s.name, 'Foo-Bar');
			bonjour.unpublish(service);
		});

		browser.on('down', (s) => {
			t.equal(s.name, 'Foo-Bar');
			bonjour.destroy();
			t.end();
		});
	});
});

test('bonjour.findOne - callback', (bonjour, t) => {
	let next = afterAll(() => {
		bonjour.findOne({ type: 'test' }, (s) => {
			t.equal(s.name, 'Callback');
			bonjour.destroy();
			t.end();
		});
	});

	bonjour.publishService({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next());
	bonjour.publishService({ name: 'Callback', type: 'test', port: 3000 }).on('up', next());
});

test('bonjour.findOne - emitter', (bonjour, t) => {
	let next = afterAll(() => {
		let browser = bonjour.findOne({ type: 'test' });
		browser.on('up', (s) => {
			t.equal(s.name, 'Emitter');
			bonjour.destroy();
			t.end();
		});
	});

	bonjour.publishService({ name: 'Emitter', type: 'test', port: 3000 }).on('up', next());
	bonjour.publishService({ name: 'Invalid', type: 'test2', port: 3000 }).on('up', next());
});

test('bonjour - a query the server cannot answer reaches the instance', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'Foo-Bar', type: 'test', port: 3000 });

	service.on('up', () => {
		let mdns = bonjour.find({ type: 'test', autostart: false })._mdns;
		let warnings = [];
		let errors = [];
		let warn = console.warn;

		console.warn = message => warnings.push(message);
		bonjour.on('error', error => errors.push(error));
		mdns.respond = (packet, cb) => cb(new Error('ENETUNREACH'));

		mdns.emit('query', { questions: [{ name: '_test._tcp.local', type: 'PTR' }]});

		console.warn = warn;

		t.equal(errors.length, 1, 'The server forwards it to the bonjour instance');
		t.equal(errors[0].message, 'ENETUNREACH', 'As the error itself');
		t.equal(warnings.length, 1, 'And it is warned about once, not twice');

		bonjour.destroy();
		t.end();
	});
});

test('bonjour.publishAddress - announcements carry the cache-flush bit', (bonjour, t) => {
	let address = bonjour.publishAddress({ name: 'foo-bar', addresses: [ '192.168.1.1' ]});

	address.on('announcing', (records) => {
		t.deepEqual(records.map(r => r.data), [ '192.168.1.1' ], 'Announces the given address');
		t.deepEqual(records.map(r => r.flush), [ true ], 'A records are flushed');
		bonjour.destroy();
		t.end();
	});
});

test('bonjour.publishAddress - re-announces when the addresses change', (bonjour, t) => {
	let address = bonjour.publishAddress({ name: 'foo-bar', addresses: [ '192.168.1.1' ]});

	address.on('up', () => {
		address.once('announcing', (records) => {
			t.deepEqual(records.map(r => r.data), [ '10.0.0.1' ], 'Re-announces the new address');
			bonjour.destroy();
			t.end();
		});

		address.addresses = [ '10.0.0.1' ];
	});
});

test('bonjour.publishAddress - several changes cost one announcement', (bonjour, t) => {
	let address = bonjour.publishAddress({ name: 'foo-bar', addresses: [ '192.168.1.1' ]});

	address.on('up', () => {
		let announcements = 0;
		address.on('announcing', () => announcements++);

		address.addresses = [ '10.0.0.1' ];
		address.addresses = [ '10.0.0.2' ];
		address.addresses = [ '10.0.0.3' ];

		setTimeout(() => {
			t.equal(announcements, 1, 'Coalesced into a single re-announcement');
			bonjour.destroy();
			t.end();
		}, 500);
	});
});
