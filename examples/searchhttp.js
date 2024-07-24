import {default as Bonjour, Service} from '../index.js';

let b = new Bonjour({});

b.find({type: 'http'}, (service) => {
	console.debug('Up', service);
}, (service) => {
	console.debug('Down', service);
});
