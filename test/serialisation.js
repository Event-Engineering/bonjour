import {Service} from '../index.js';

let original = Service._fromObject({name: 'steve'});

let a1 = structuredClone(original);
let b1 = {...original};
let c1 = Object.entries(original);

let a2 = structuredClone(original.toObject());
let b2 = {...original.toObject()};
let c2 = Object.entries(original.toObject());

console.debug('What have we got?', {original, jsonCloned: JSON.parse(JSON.stringify(original)), fromOriginal: {a1, b1, c1}, fromToObjected: {a2, b2, c2}, string: original.toString()});
