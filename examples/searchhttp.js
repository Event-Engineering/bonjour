import Bonjour from '../index.js';

let b = new Bonjour({});

console.debug('Searching for HTTP services');

b.find({type: 'http'}, (service) => {
	console.debug('Up', service);
}, (service) => {
	console.debug('Down', service);
});
