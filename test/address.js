import os from 'os';
import test from 'tape';
import { Address } from '../index.js';

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
		new Address({ });
	}, 'No name not given');
	t.end();
});

test('empty name', (t) => {
	t.throws(() => {
		new Address({ name: '' });
	}, 'Empty name not given');
	t.end();
});

test('valid characters in name', (t) => {
	t.doesNotThrow(() => {
		new Address({ name: 'abcdefghijklmnopqrstuvwxyz' });
	}, 'Lowercase characters given');
	t.doesNotThrow(() => {
		new Address({ name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
	}, 'Uppercase characters given');
	t.doesNotThrow(() => {
		new Address({ name: 'a-01234567890' });
	}, 'Numerals and hyphens given');
	t.doesNotThrow(() => {
		new Address({ name: 'this.is.a.test' });
	}, 'Multiple parts given');
	t.end();
});

test('invalid character name', (t) => {
	t.throws(() => {
		new Address({ name: '@' });
	}, 'Invalid character given');
	t.throws(() => {
		new Address({ name: 'Foo Bar' });
	}, 'Invalid character given');
	t.throws(() => {
		new Address({ name: 'Foo_Bar' });
	}, 'Invalid character given');
	t.throws(() => {
		new Address({ name: '-nope' });
	}, 'Start with hyphen');
	t.throws(() => {
		new Address({ name: 'nope-' });
	}, 'End with hyphen');
	t.throws(() => {
		new Address({ name: '0nope' });
	}, 'Start with number');
	t.throws(() => {
		new Address({ name: 'test.-nope' });
	}, 'Start second part with hyphen');
	t.throws(() => {
		new Address({ name: 'nope-.test' });
	}, 'End first part with hyphen');
	t.throws(() => {
		new Address({ name: 'test.0nope' });
	}, 'Start second part with number');
	t.end();
});

test('max name legnth', (t) => {
	t.doesNotThrow(() => {
		new Address({ name: 'this.is.long.oversized.domain.name.and.should.be.less.long.as.someone.once.put.a.limit.of.two-hundred.and.fifty-five.characters.which.is.a.long.string.to.waffle.but.waffle.I.can.do.though.this.could.fail.for.a.bunch.of.other.reasons.like.character.choices' });
	}, 'Max name length');
	t.throws(() => {
		new Address({ name: 'this.is.long.oversized.domain.name.and.should.be.less.long.as.someone.once.put.a.limit.of.two-hundred.and.fifty-five.characters.which.is.a.long.string.to.waffle.but.maybe.I.can.waffle.enough.and.hope.this.doesnt.fail.for.any.other.reasons.I.may.have.missed' });
	}, 'Max name length + 1');
	t.end();
});

test('max name part length', (t) => {
	t.doesNotThrow(() => {
		new Address({ name: 'this-is-long-oversized-part-to-a-domain-name-and-neednt-be-less' });
	}, 'Max name part length');
	t.throws(() => {
		new Address({ name: 'this-is-long-oversized-part-to-a-domain-name-and-must-be-smaller' });
	}, 'Max name part length + 1');
	t.end();
});

test('minimal', (t) => {
	let s = new Address({ name: 'Foo-Bar' });
	t.equal(s.name, 'Foo-Bar.local');
	t.equal(s.published, false);
	t.end();
});

test('_records() - minimal', (t) => {
	let s = new Address({ name: 'Foo-Bar' });
	t.deepEqual(s._records(), getAddressesRecords('Foo-Bar.local'));
	t.end();
});
