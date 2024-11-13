import * as HashRing from "hashring";

// @ts-expect-error
const ring = new HashRing.default([
    '127.0.0.1',
    '127.0.0.2',
    '127.0.0.3', 
    '127.0.0.4'
  ], 'md5', {
    'max cache size': 10000
  });
 
// Now we are going to get some a server for a key
console.log(ring.get('foo bar banana')); // returns 127.0.0.x