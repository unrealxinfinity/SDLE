import * as zmq from "zeromq";
import { PNShoppingMap } from "../crdt/PNShoppingMap";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
  const sock = new zmq.Request();
  sock.connect(frontAddr);
  
  const msg = "afafawfpiojafgoihgoaihgoaeighoigha";
  
  console.log(`socket ${process.env.ID} recieved list id ${msg.toString()}`);

  const list = new PNShoppingMap("c1");
  list.add("apple", 2);
  list.add("flour", 32);

  const uploadMsg = {
    type: "upload",
    id: msg.toString(),
    list: list.toJSON()
  };

  await sock.send(JSON.stringify(uploadMsg));

  const uploadReply = await sock.receive();
  console.log(uploadReply.toString());

  for (let i = 0; i < 3500; i++) {
    list.add("grape");

    const updateMsg = {
      type: "update",
      id: msg.toString(),
      list: list.toJSON()
    };

    await sock.send(JSON.stringify(updateMsg));

    const updateReply = await sock.receive();
    console.log(updateReply.toString());
  }

  const fetchMsg = {
    type: "fetch",
    id: msg.toString()
  };

  await sock.send(JSON.stringify(fetchMsg));

  const fetchReply = JSON.parse((await sock.receive()).toString());
  console.log(fetchReply);

  sock.close();
  //cluster.worker.kill();
}

clientProcess();
