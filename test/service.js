import os from 'os';
import test from 'tape';
import {Service} from '../index.js';

function getAddressesRecords(host) {
	let records = [];
	let itrs = os.networkInterfaces();
	for (let i in itrs) {
		let addrs = itrs[i]
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
		new Service({ type: 'http', port: 3000 }); // eslint-disable-line no-new
	}, 'Required name not given');
	t.end();
});

test('no type', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo Bar', port: 3000 }); // eslint-disable-line no-new
	}, 'Required type not given');
	t.end();
});

test('no port', (t) => {
	t.throws(() => {
		new Service({ name: 'Foo Bar', type: 'http' }); // eslint-disable-line no-new
	}, 'Required port not given');
	t.end();
});

test('minimal', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', port: 3000 });
	t.equal(s.name, 'Foo Bar');
	t.equal(s.protocol, 'tcp');
	t.equal(s.type, '_http._tcp');
	t.equal(s.host, os.hostname());
	t.equal(s.port, 3000);
	t.equal(s.fqdn, 'Foo Bar._http._tcp.local');
	t.equal(s.txt, null);
	t.equal(s.subtypes, null);
	t.equal(s.published, false);
	t.end();
});

test('protocol', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, protocol: 'udp' });
	t.deepEqual(s.protocol, 'udp');
	t.end();
});

test('host', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, host: 'example.com' });
	t.deepEqual(s.host, 'example.com');
	t.end();
});

test('txt', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', port: 3000, txt: { foo: 'bar' } });
	t.deepEqual(s.txt, { foo: 'bar' });
	t.end();
});

test('_records() - minimal', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', protocol: 'tcp', port: 3000 });
	t.deepEqual(s._records(), [
		{ data: '_http._tcp.local', name: '_services._dns-sd._udp.local', ttl: 28800, type: 'PTR' },
		{ data: s.fqdn, name: '_http._tcp.local', ttl: 28800, type: 'PTR' },
		{ data: { port: 3000, target: os.hostname() }, name: s.fqdn, ttl: 120, type: 'SRV' },
		{ data: Buffer.from('00', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' },
	].concat(getAddressesRecords(s.host + '.local')));
	t.end();
});

test('_records() - everything', (t) => {
	let s = new Service({ name: 'Foo Bar', type: 'http', protocol: 'tcp', port: 3000, host: 'example.com', txt: { foo: 'bar' } });
	t.deepEqual(s._records(), [
		{ data: '_http._tcp.local', name: '_services._dns-sd._udp.local', ttl: 28800, type: 'PTR' },
		{ data: s.fqdn, name: '_http._tcp.local', ttl: 28800, type: 'PTR' },
		{ data: { port: 3000, target: 'example.com' }, name: s.fqdn, ttl: 120, type: 'SRV' },
		{ data: Buffer.from('07666f6f3d626172', 'hex'), name: s.fqdn, ttl: 4500, type: 'TXT' },
	].concat(getAddressesRecords(s.host + '.local')));
	t.end();
});
