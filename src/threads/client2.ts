import * as zmq from "zeromq";
import { PNShoppingMap } from "../crdt/PNShoppingMap.js";

const frontAddr = "tcp://127.0.0.1:12346";
const id = "808082b1-0ed7-4fcc-8716-0883e7561996";

async function clientProcess() {
  const sock = new zmq.Request();
  sock.connect(frontAddr);

  const fetchMsg = {
    type: "fetch",
    id
  };

  await sock.send(JSON.stringify(fetchMsg));

  const fetchReply = JSON.parse((await sock.receive()).toString());
  console.log(fetchReply.toString());

  const list = PNShoppingMap.fromJSON(fetchReply.list,"c2");

  for (let i = 0; i < 1000; i++) {
    list.add("flour", 2);
    if (i%100 == 0) {
        list.add("grape", 5);
    }

    const updateMsg = {
      type: "update",
      id,
      list: list.toJSON()
    };

    await sock.send(JSON.stringify(updateMsg));

    const updateReply = await sock.receive();
    console.log(updateReply.toString());
  }

  sock.close();
  //cluster.worker.kill();
}

clientProcess();
