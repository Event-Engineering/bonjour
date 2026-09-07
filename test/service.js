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

test('txt - numbers arrive as numbers', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });
	s.rawTxt = [ Buffer.from('port=3000'), Buffer.from('ratio=1.5'), Buffer.from('below=-3'), Buffer.from('zero=0') ];

	t.deepEqual(s.txt, { port: 3000, ratio: 1.5, below: - 3, zero: 0 });
	t.end();
});

test('txt - values that would not survive the trip stay as they were written', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });
	s.rawTxt = [
		Buffer.from('serial=007'),
		Buffer.from('version=1.10'),
		Buffer.from('scientific=1e3'),
		Buffer.from('padded= 12'),
		Buffer.from('hex=0x10'),
		Buffer.from('huge=9007199254740993'),
		Buffer.from('endless=Infinity'),
		Buffer.from('empty='),
	];

	t.deepEqual(s.txt, {
		serial: '007',
		version: '1.10',
		scientific: '1e3',
		padded: ' 12',
		hex: '0x10',
		huge: '9007199254740993',
		endless: 'Infinity',
		empty: '',
	});
	t.end();
});

test('txt - a number goes out and comes back a number', (t) => {
	let published = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { port: 3000 }});
	let found = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });

	t.deepEqual(published.rawTxt, [ Buffer.from('port=3000') ], 'Written as its digits');

	found.rawTxt = published.rawTxt;
	t.deepEqual(found.txt, { port: 3000 }, 'And read back as a number');
	t.end();
});

test('txt - binary values are left alone', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txtSettings: { binary: true }});
	s.rawTxt = [ Buffer.from('port=3000') ];

	t.deepEqual(s.txt, { port: Buffer.from('3000') }, 'Still a buffer, not a number');
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
	let warnings = [];
	let warn = console.warn;
	console.warn = message => warnings.push(message);

	let longest = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { key: 'x'.repeat(251), keep: 'me' }});
	let toolong = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { key: 'x'.repeat(252), keep: 'me' }});

	console.warn = warn;

	t.equal(longest.rawTxt.length, 2, 'The longest allowed pair is carried');
	t.deepEqual(Object.keys(toolong.txt), [ 'key', 'keep' ], 'One byte too far is still yours to keep');
	t.equal(toolong.rawTxt.length, 1, 'But is left out of the record, which carries the rest');
	t.equal(warnings.length, 1, 'And is warned about');
	t.end();
});

test('_freeze() - a found service is not ours to change', (t) => {
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000, txt: { foo: 'bar' }});
	let held = s.txt;

	s._freeze();

	t.throws(() => {
		s.txt.foo = 'baz';
	}, 'Changing a pair throws');
	t.throws(() => {
		held.foo = 'baz';
	}, 'Including through a reference taken beforehand');
	t.deepEqual(s.rawTxt, [ Buffer.from('foo=bar') ], 'And the record is left alone');
	t.end();
});

test('rawTxt - pairs we cannot use are skipped, not fatal', (t) => {
	let raw = [ Buffer.from('=nokey'), Buffer.from('bad\x01key=x'), Buffer.from('foo=bar'), Buffer.from('foo=second'), Buffer.from('secure') ];
	let s = new Service({ name: 'Foo-Bar', type: 'http', port: 3000 });

	let warnings = [];
	let warn = console.warn;
	console.warn = message => warnings.push(message);

	s.rawTxt = raw;
	let txt = s.txt;

	console.warn = warn;

	t.deepEqual(txt, { foo: 'bar', secure: true }, 'Keyless and unprintable pairs dropped, a repeated key keeps the first');
	t.equal(warnings.length, 2, 'One warning each for the two we could not read, none for the repeat');
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
