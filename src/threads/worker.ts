import * as HashRing from "hashring";
import * as zmq from "zeromq";

const backAddr = "tcp://127.0.0.1:12345";

function buildHashRing(ids: string[]): HashRing {
    // @ts-expect-error
    const hashRing = new HashRing.default([], 'md5', {"replicas": 1}) as HashRing;

    for (const id of ids) {
        const node = {};
        node[id] = {"vnodes": 1};
        hashRing.add(node);
    }

    return hashRing;
}

export default async function workerProcess() {
    const sock = new zmq.Request();
    sock.routingId = process.env.ID;
    let hr: HashRing | null = null;
    sock.connect(backAddr);
  
    const readyMsg = {
      type: "ready",
    };
    sock.send(JSON.stringify(readyMsg));
  
    for await (const msg of sock) {
      const contents = JSON.parse(msg[2].toString());
      hr = buildHashRing(contents.workerIds);
      console.log(hr);
  
      const reply = {
        type: contents.type,
        message: `${contents.type} to you too`
      };
      sock.send([msg[0], '', JSON.stringify(reply)]);
    }
  }