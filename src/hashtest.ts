import * as HashRing from "hashring";

// @ts-expect-error
const ring = new HashRing.default({
    '127.0.0.2': {vnodes: 1},
    '127.0.0.5': {vnodes: 1},
    '127.0.0.3': {vnodes: 1}, 
    '127.0.0.1': {vnodes: 1}
  }, 'md5', {
    "replicas": 1
  }) as HashRing;

console.log(ring);

// @ts-expect-error
const p = ring.points();
 
// Now we are going to get some a server for a key
console.log(ring.get("banana")); // returns 127.0.0.x