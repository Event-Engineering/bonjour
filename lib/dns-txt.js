export default class {
	#opts;

	get binary() {
		return !! this.#opts?.binary;
	}

	constructor(opts) {
		this.#opts = opts || {};
	}

	encode(data = {}, txtBuffer = null, offset = 0) {
		if ( ! data) {
			data = {};
		}
		if ( ! txtBuffer) {
			txtBuffer = Buffer.alloc(this.encodingLength(data) + offset);
		}

		const oldOffset = offset;

		if ( ! Object.keys(data).length) {
			txtBuffer[offset] = 0;
			offset++;
		}

		Object.entries(data)
		.forEach(([key, value]) => {
			let oldOffset = offset;
			offset++;

			if (value === true) {
				offset += txtBuffer.write(key,offset);
			} else if (Buffer.isBuffer(value)) {
				offset += txtBuffer.write(key + '=', offset);
				let length = value.length;
				value.copy(txtBuffer, offset, 0, length);
				offset += length;
			} else {
				offset += txtBuffer.write(key + '=' + value, offset);
			}

			txtBuffer[oldOffset] = offset - oldOffset - 1;
		});

		this.encode.bytes = offset - oldOffset;
		return txtBuffer;
	}

	decode(txtBuffer, offset = 0, length = null) {
		if ( ! Number.isFinite(length)) {
			length = txtBuffer.length;
		}

		const oldOffset = offset;
		let data = {};

		while (offset < length) {
			let byteLength = txtBuffer[offset] + 1;
			let to = offset + byteLength;
			let bufferPart = txtBuffer.slice(offset + 1, to > txtBuffer.length ? txtBuffer.length : to);
			let index = bufferPart.indexOf(Buffer.from('='));
			offset += byteLength;

			if (bufferPart.length === 0 || index === 0) {
				continue; // ignore: most likely a single zero byte or invalid key
			}

			let key = (index === -1 ? bufferPart : bufferPart.slice(0, index)).toString().toLowerCase();

			if (key in data) {
				continue; // ignore: overwriting not allowed
			}

			data[key] = (index === -1 ? true : (this.binary ? bufferPart.slice(index + 1) : bufferPart.slice(index + 1).toString()));
		}

		this.decode.bytes = offset - oldOffset;
		return data;
	}

	encodingLength(data) {
		return Math.max(1, Object.entries(data || {})
		.reduce((total, [key, value]) => {
			return total + Buffer.byteLength(key) + 2 + (Buffer.isBuffer(value) ? value.length : Buffer.byteLength(String(value)));
		}, 0));
	}
}
