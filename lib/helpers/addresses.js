import os from 'os';
import { isIP } from 'node:net';

/**
 * The A and AAAA records advertising a name.
 *
 * Publishes the addresses given, where there are any, and the host's own
 * external interfaces otherwise. Anything that is not an IP address is
 * reported and left out, rather than put on the wire as nonsense.
 */
export default function addressRecords(name, addresses) {
	let sources;

	if (addresses.length) {
		sources = addresses
		.filter((address) => {
			if (isIP(address)) {
				return true;
			}

			console.warn('Ignoring "' + address + '" advertised for ' + name + ': not an IP address');

			return false;
		})
		.map((address) => {
			return { address, family: isIP(address) === 4 ? 'IPv4' : 'IPv6' };
		});
	} else {
		sources = Object.values(os.networkInterfaces())
		.flat()
		.filter((address) => {
			return ! address.internal && address.mac !== '00:00:00:00:00:00';
		});
	}

	return sources
	.map((source) => {
		return {
			name,
			type: source.family === 'IPv4' ? 'A' : 'AAAA',
			ttl: 120,
			data: source.address,
		};
	});
}
