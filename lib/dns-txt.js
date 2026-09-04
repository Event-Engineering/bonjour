const EQUALS = '='.charCodeAt(0);
const MAX_CHARACTER_STRING = 255;

/**
 * The key/value pairs of a TXT record, per RFC-6763 section 6.
 *
 * A TXT record is a sequence of character-strings, each one a "key=value"
 * pair. The length prefixes that separate them belong to the DNS wire format
 * and are written by dns-packet, so everything here works in bare pairs: a
 * record is an array of buffers, one per pair, and the object it decodes to is
 * flat.
 */
export default class {
	#opts;

	get binary() {
		return !! this.#opts?.binary;
	}

	constructor(opts) {
		this.#opts = opts || {};
	}

	/**
	 * Encode a key/value object as the character-strings of a TXT record.
	 *
	 * A value of true is a valueless attribute, written as a bare key with no
	 * "=" at all. An empty object still has to produce one empty
	 * character-string, as a TXT record may not be empty.
	 */
	encode(data) {
		let pairs = Object.entries(data || {})
		.map(([ key, value ]) => {
			if (value === true) {
				return Buffer.from(key);
			}

			let prefix = Buffer.from(key + '=');

			return Buffer.concat(Buffer.isBuffer(value) ? [ prefix, value ] : [ prefix, Buffer.from(String(value)) ]);
		});

		pairs.forEach((pair) => {
			if (pair.length > MAX_CHARACTER_STRING) {
				throw new Error('Invalid TXT record. A key/value pair must encode to ' + MAX_CHARACTER_STRING + ' bytes or fewer, "' + pair.slice(0, 20).toString() + '..." is ' + pair.length);
			}
		});

		return pairs.length ? pairs : [ Buffer.alloc(0) ];
	}

	/**
	 * Decode the character-strings of a TXT record into a flat object.
	 *
	 * Anything the specification tells us to disregard - an empty pair, a
	 * zero-length key, a key we have already seen - is skipped rather than
	 * rejected, so one bad pair cannot cost us the rest of the record.
	 */
	decode(rawTxt) {
		let data = {};

		(Array.isArray(rawTxt) ? rawTxt : [ rawTxt ])
		.forEach((pair) => {
			if (! pair?.length) {
				return; // the empty character-string of an empty TXT record
			}

			let index = pair.indexOf(EQUALS);

			if (index === 0) {
				return; // a zero-length key is not a valid pair
			}

			let key = (index === - 1 ? pair : pair.subarray(0, index)).toString().toLowerCase();

			if (key in data) {
				return; // a repeated key keeps its first value
			}

			if (index === - 1) {
				data[key] = true; // a valueless attribute, present but with nothing to say
				return;
			}

			let value = pair.subarray(index + 1);

			data[key] = this.binary ? value : value.toString();
		});

		return data;
	}
}
