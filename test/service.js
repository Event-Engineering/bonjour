import os from 'os';
import test from 'tape';
import { Service } from '../index.js';

function getAddressesRecords(host) {
	let records = [];
	let itrs = os.networkInterfaces();
	for (let i in itrs) {
		let addrs = itrs[i];
		for (let j in addrs) {
			if (addrs[j].internal === false) {
				records.push({ data: addrs[j].address, name: host, ttl: 120, type: addrs[j].family === 'IPv4' ? 'A' : 'AAAA' });
			}
		}
	}
	return records;
}

test('no name', (t) => {
	t.throws(() => {
		new Service({ type: 'http', port: 3000 });
	}, 'Required name not given');
	t.end();
});

test('empty name', (t) => {
	t.throws(() => {
		new Service({ name: '', type: 'http', port: 3000 });
	}, 'Required name not given');
	t.end();
});

test('invalid character name', (t) => {
	t.throws(() => {
		new Service({ name: '@', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('invalid characters in name', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo Bar', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('oversized name', (t) => {
	t.throws(() => {
		new Service({ name: 'this-is-a-long-name', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('invalid start character in name', (t) => {
	t.throws(() => {
		new Service({ name: '00foo-bar', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('invalid end character in name', (t) => {
	t.throws(() => {
		new Service({ name: 'foo-bar-', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('valid weird start characters in name', (t) => {
	t.doesNotThrow(() => {
		new Service({ name: '0-foo-bar', type: 'http', port: 3000 });
	}, 'Valid name given');
	t.end();
});

test('double dash in name', (t) => {
	t.throws(() => {
		new Service({ name: 'foo--bar', type: 'http', port: 3000 });
	}, 'Invalid name given');
	t.end();
});

test('no type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', port: 3000 });
	}, 'Required type not given');
	t.end();
});

test('empty type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: '', port: 3000 });
	}, 'Required name not given');
	t.end();
});

test('invalid character type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: '@', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('invalid characters in type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'ht tp', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('oversized type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'this-is-a-long-name', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('invalid start character in type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: '00foo-bar', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('invalid end character in type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'foo-bar-', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('valid weird start characters in type', (t) => {
	t.doesNotThrow(() => {
		new Service({ name: 'Foo-Bar', type: '0-foo-bar', port: 3000 });
	}, 'Valid type given');
	t.end();
});

test('double dash in type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'foo--bar', port: 3000 });
	}, 'Invalid type given');
	t.end();
});

test('no port', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'http' });
	}, 'Required port not given');
	t.end();
});

test('negative port', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: - 1 });
	}, 'Invalid port given');
	t.end();
});

test('zero port', (t) => {
	t.doesNotThrow(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: 0 });
	}, 'Valid port given');
	t.end();
});

test('max port', (t) => {
	t.doesNotThrow(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: 65535 });
	}, 'Valid port given');
	t.end();
});

test('excessive port', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: 65536 });
	}, 'Invalid port given');
	t.end();
});

test('minimal', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });
	t.equal(s.name, 'Foo-Bar');
	t.equal(s.protocol, 'tcp');
	t.equal(s.type, 'http');
	t.equal(s.protocol, 'tcp');
	t.equal(s.host, os.hostname() + '.local');
	t.equal(s.port, 3000);
	t.equal(s.dn, '_http._tcp.local');
	t.equal(s.fqdn, 'Foo-Bar._http._tcp.local');
	t.equal(s.txt, undefined);
	t.equal(s.subtypes, undefined);
	t.equal(s.published, false);
	t.end();
});

test('protocol', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, protocol: 'udp' });
	t.deepEqual(s.protocol, 'udp');
	t.end();
});

test('host', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, host: 'example.com' });
	t.deepEqual(s.host, 'example.com.local');
	t.end();
});

test('txt', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { foo: 'bar' }});
	t.deepEqual(s.txt, { foo: 'bar' });
	t.deepEqual(s.rawTxt, [ Buffer.from('foo=bar') ], 'Encoded as one bare pair');
	t.end();
});

test('txt - valueless attributes', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { secure: true }});
	t.deepEqual(s.rawTxt, [ Buffer.from('secure') ], 'Written without an equals sign');
	t.deepEqual(s.txt, { secure: true }, 'Read back as true');
	t.end();
});

test('txt - changed in place', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { foo: 'bar' }});

	s.txt.foo = 'baz';
	t.deepEqual(s.rawTxt, [ Buffer.from('foo=baz') ], 'Assigning a pair re-encodes the record');

	delete s.txt.foo;
	t.deepEqual(s.rawTxt, [ Buffer.alloc(0) ], 'Emptying it keeps the one empty character-string');
	t.end();
});

test('txt - a replaced txt no longer drives the record', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { foo: 'bar' }});
	let stale = s.txt;

	s.txt = { replaced: 'yes' };
	stale.foo = 'changed';

	t.deepEqual(s.txt, { replaced: 'yes' }, 'The current txt is untouched');
	t.deepEqual(s.rawTxt, [ Buffer.from('replaced=yes') ], 'And the record still matches it');
	t.end();
});

test('txtObj - a replaced txtObj no longer drives the record', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { foo: 'bar' }});
	let stale = s.txtObj;

	s.txtObj = { replaced: 'yes' };
	delete stale.foo;

	t.deepEqual(s.txtObj, { replaced: 'yes' }, 'The current txtObj is untouched');
	t.deepEqual(s.rawTxt, [ Buffer.from('replaced=yes') ], 'And the record still matches it');
	t.end();
});

test('txt - a pair may not exceed 255 bytes', (t) => {
	t.doesNotThrow(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { key: 'x'.repeat(251) }});
	}, 'The longest allowed pair');
	t.throws(() => {
		new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { key: 'x'.repeat(252) }});
	}, 'One byte too far');
	t.end();
});

test('rawTxt - pairs we cannot use are skipped, not fatal', (t) => {
	let raw = [ Buffer.from('=nokey'), Buffer.from('foo=bar'), Buffer.from('foo=second'), Buffer.from('secure') ];
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });
	s.rawTxt = raw;

	t.deepEqual(s.txt, { foo: 'bar', secure: true }, 'Zero-length key dropped, repeated key keeps the first');
	t.deepEqual(s.rawTxt, raw, 'The record itself is preserved as it arrived');
	t.end();
});

test('_records() - minimal', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', protocol: 'tcp', port: 3000 });
	t.deepEqual(s._records(), [
		{ data: '_http._tcp.local', name: '_services._dns-sd._udp.local', ttl: 4500, type: 'PTR' },
		{ data: s.fqdn, name: '_http._tcp.local', ttl: 4500, type: 'PTR' },
		{ data: { port: 3000, target: os.hostname() + '.local' }, name: s.fqdn, ttl: 120, type: 'SRV' },
		{ data: [ Buffer.alloc(0) ], name: s.fqdn, ttl: 4500, type: 'TXT' },
	].concat(getAddressesRecords(s.host)));
	t.end();
});

test('_records() - everything', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', protocol: 'tcp', port: 3000, host: 'example.com', txt: { foo: 'bar' }});
	t.deepEqual(s._records(), [
		{ data: '_http._tcp.local', name: '_services._dns-sd._udp.local', ttl: 4500, type: 'PTR' },
		{ data: s.fqdn, name: '_http._tcp.local', ttl: 4500, type: 'PTR' },
		{ data: { port: 3000, target: 'example.com' + '.local' }, name: s.fqdn, ttl: 120, type: 'SRV' },
		{ data: [ Buffer.from('foo=bar') ], name: s.fqdn, ttl: 4500, type: 'TXT' },
	].concat(getAddressesRecords(s.host)));
	t.end();
});
