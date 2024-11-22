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
    const listReceiver = new zmq.Reply();
    sock.routingId = process.env.ID;
    sock.connect(backAddr);
    await listReceiver.bind(`tcp://*:${process.env.PORT}`);
  
    const readyMsg = {
      type: "ready",
    };
    sock.send(JSON.stringify(readyMsg));
  
    await Promise.all([processRequests(sock), receiveLists(listReceiver)]);  
  }

  async function processRequests(sock: zmq.Request) {
    let hr: HashRing | null = null;

    for await (const msg of sock) {
        const contents = JSON.parse(msg[2].toString());
        console.log(process.env.ID, contents);
        hr = buildHashRing(contents.workerIds);
    
        const reply = {
          type: contents.type,
          message: `${contents.type} to you too`
        };
        sock.send([msg[0], '', JSON.stringify(reply)]);
      }
  }

  async function receiveLists(listReceiver: zmq.Reply) {
    for await (const msg of listReceiver) {
        // do something
    }
  }