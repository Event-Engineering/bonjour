import os from 'os';
import dgram from 'dgram';
import tape from 'tape';
import afterAll from 'after-all';
import {default as Bonjour, Service} from '../index.js';

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
	t.ok(service instanceof Service);
	t.equal(service.published, false);
	service.on('up', () => {
		t.equal(service.published, true);
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
				t.equal(service.published, false);
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

test('bonjour.find', (bonjour, t) => {
	let next = afterAll(() => {
		let browser = bonjour.find({ type: 'test' });
		let ups = 0;

		browser.on('up', (s) => {
			if (s.name === 'Foo-Bar') {
				t.equal(s.name, 'Foo-Bar');
				t.equal(s.fqdn, 'Foo-Bar._test._tcp.local');
				t.deepEqual(s.txt, [{}]);
				t.deepEqual(s.rawTxt, [Buffer.from('00', 'hex')]);
			} else {
				t.equal(s.name, 'Baz');
				t.equal(s.fqdn, 'Baz._test._tcp.local');
				t.deepEqual(s.txt, [{ foo: 'bar' }]);
				t.deepEqual(s.rawTxt, [Buffer.from('07666f6f3d626172', 'hex')]);
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
	bonjour.publishService({ name: 'Baz', type: 'test', port: 3000, txt: { foo: 'bar' } }).on('up', next());
});

test('bonjour.find - binary txt', (bonjour, t) => {
	let next = afterAll(() => {
		let browser = bonjour.find({ type: 'test', txt: { binary: true } });

		browser.on('up', (s) => {
			t.equal(s.name, 'Foo');
			t.deepEqual(s.txt, [{ bar: Buffer.from('buz') }]);
			t.deepEqual(s.rawTxt, [Buffer.from('076261723d62757a', 'hex')]);
			bonjour.destroy();
			t.end();
		});
	});

	bonjour.publishService({ name: 'Foo', type: 'test', port: 3000, txt: { bar: Buffer.from('buz') } }).on('up', next());
});

test('bonjour.find - down event', (bonjour, t) => {
	let service = bonjour.publishService({ name: 'Foo-Bar', type: 'test', port: 3000 });

	service.on('up', () => {
		let browser = bonjour.find({ type: 'test' });

		browser.on('up', (s) => {
			t.equal(s.name, 'Foo-Bar');
			service.stop();
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
