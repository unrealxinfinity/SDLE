import * as zmq from "zeromq";

const backAddr = "tcp://127.0.0.1:12345";

export default async function workerProcess() {
    const sock = new zmq.Request();
    sock.routingId = process.env.ID;
    sock.connect(backAddr);
  
    const readyMsg = {
      type: "ready",
    };
    sock.send(JSON.stringify(readyMsg));
  
    for await (const msg of sock) {
      const contents = JSON.parse(msg[2].toString());
  
      const reply = {
        type: contents.type,
        message: `${contents.type} to you too`
      };
      sock.send([msg[0], '', JSON.stringify(reply)]);
    }
  }