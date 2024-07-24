import {default as Bonjour, Service} from '../index.js';

let b = new Bonjour({});

console.debug('Searching for all services');

b.find({}, (service) => {
	console.debug('Up', service);
}, (service) => {
	console.debug('Down', service);
});
