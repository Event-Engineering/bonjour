import test from 'tape';
import { Service } from '../index.js';

function build() {
	return new Service({ name: 'steve', type: 'http', port: 3000, host: 'box', txt: { foo: 'bar' }});
}

test('toObject() - the service as plain data', (t) => {
	let s = build();
	let o = s.toObject();

	t.equal(o.fqdn, 'steve._http._tcp.local');
	t.equal(o.name, 'steve');
	t.equal(o.host, 'box.local');
	t.equal(o.port, 3000);
	t.deepEqual(o.txt, { foo: 'bar' });
	t.end();
});

test('toObject() - spreads and clones as itself', (t) => {
	let o = build().toObject();
	let cloned = structuredClone(o);

	t.deepEqual({ ...o }, o, 'Spreading keeps every field');
	t.equal(cloned.fqdn, o.fqdn, 'And a structured clone survives the trip');
	t.deepEqual(cloned.txt, { foo: 'bar' });
	t.end();
});

test('toJSON() - survives a JSON round trip', (t) => {
	let s = build();
	let clone = JSON.parse(JSON.stringify(s));

	t.equal(clone.fqdn, s.fqdn, 'JSON.stringify uses toJSON, so the service comes back whole');
	t.equal(clone.port, s.port);
	t.deepEqual(clone.txt, { foo: 'bar' });
	t.end();
});

test('the service itself is not plain data', (t) => {
	let s = build();

	t.equal({ ...s }.fqdn, undefined, 'Spreading a Service gives the emitter internals, not the service');
	t.ok(s.toString().startsWith('steve._http._tcp.local'), 'toString() describes it instead');
	t.end();
});
