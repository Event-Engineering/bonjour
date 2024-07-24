import {default as Bonjour, Service} from '../index.js';

let b = new Bonjour({});

console.debug('Searching for QLab services');

b.find({type: 'qlab', protocol: 'udp', txt: {binary: true}}, (service) => {
	console.debug('Up', service);

	let test = service.txt.version;

	Object.getOwnPropertyNames(Object.getPrototypeOf(test))
	.filter(m => m != 'constructor' && 'function' === typeof test[m] && m.startsWith('to'))
	.forEach((functionName) => {
		try {
			let value = test[functionName]();
			setTimeout(() => {
				console.debug('What have we here?', {functionName, value});
			});
		} catch (e) {}
	});
}, (service) => {
	console.debug('Down', service);
});
