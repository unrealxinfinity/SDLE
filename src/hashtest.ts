import * as HashRing from "hashring";

// @ts-expect-error
const ring = new HashRing.default({
    '127.0.0.2': {vnodes: 5},
    '127.0.0.5': {vnodes: 5},
    '127.0.0.3': {vnodes: 5}, 
    '127.0.0.1': {vnodes: 5}
  }, 'md5', {
    "replicas": 1
  }) as HashRing;

console.log(ring);

const p = ring.continuum();
ring.add({'12': {vnodes: 5}});

// @ts-expect-error
console.log(ring.ring);

// Now we are going to get some a server for a key
console.log(ring.get("127.0.0.3")); // returns 127.0.0.x