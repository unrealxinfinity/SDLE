import * as HashRing from "hashring";
import * as zmq from "zeromq";
import { PNShoppingMap } from "../crdt/PNShoppingMap.js";

const backAddr = "tcp://127.0.0.1:12345";
const lists = {};
lists[`${process.env.ID}-testlist`] = { banana: 1 };
lists[`${process.env.ID}-testlist2`] = { apples: 3 };
let hr: HashRing | null = null;
const shoppingLists: {[key: string]: PNShoppingMap} = {};

function buildHashRing(ids: any): HashRing {
  // @ts-expect-error
  const hashRing = new HashRing.default([], "md5", { replicas: 1 }) as HashRing;

  for (const id in ids) {
    if (id === process.env.ID) {
      continue;
    }
    const node = {};
    node[id] = { vnodes: 5 };
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

  hr = buildHashRing(JSON.parse(process.env.WORKERIDS));
  if (process.env.INITIAL !== "true") {
    await syncLists();
  }

  const readyMsg = {
    type: "ready",
  };
  await sock.send(JSON.stringify(readyMsg));

  await Promise.all([processRequests(sock), workerComms(listReceiver)]);
}

async function syncLists() {
  const workers = JSON.parse(process.env.WORKERIDS);
  for (const worker in workers) {
    if (worker === process.env.ID) continue;
    const requester = new zmq.Request();
    requester.connect(`tcp://127.0.0.1:${workers[worker]}`);

    const request = {
      type: "transfer",
      id: process.env.ID
    };

    await requester.send(JSON.stringify(request));

    const reply = await requester.receive();
    console.log(JSON.parse(reply.toString()));
  }
}

async function cacheMiss(port: number, listID: string) {
  const requester = new zmq.Request();
  requester.connect(`tcp://127.0.0.1:${port}`);

  const request = {
    type: "give",
    id: listID
  };

  await requester.send(JSON.stringify(request));
  const msg = await requester.receive();
  console.log(msg);
}

async function processRequests(sock: zmq.Request) {
  for await (const msg of sock) {
    const contents = JSON.parse(msg[2].toString());
    console.log(process.env.ID, contents);
    process.env.WORKERIDS = JSON.stringify(contents.workerIds);
    hr = buildHashRing(contents.workerIds);

    switch (contents.type) {
      case "kill":
        for (const list in lists) {
          const responsible = hr.get(list);
          const sender = new zmq.Request();
          console.log(
            `tcp://127.0.0.1:${contents.workerIds[responsible]}`
          );
          sender.connect(
            `tcp://127.0.0.1:${contents.workerIds[responsible]}`
          );

          while (true) {
            const msg = { id: list, list: lists[list], type: "killed" };
            sender.send(JSON.stringify(msg));

            const [rep] = await sender.receive();
            const repObj = JSON.parse(rep.toString());
            if (repObj.type === "ACK") break;
          }
        }
        
        const confirmation = {type: "i am dead"}
        sock.send([msg[0], "", JSON.stringify(confirmation)]);
        break;
      case "upload":
        const newList = PNShoppingMap.fromJSON(contents.list,"", contents.id);
        shoppingLists[contents.id] = newList;
        const uploadReply = {
          type: "upload",
          message: `List ${contents.id} has been uploaded.`
        };
        sock.send([msg[0], "", JSON.stringify(uploadReply)]);
        break;
      case "update":
        const receivedList = PNShoppingMap.fromJSON(contents.list,"", contents.id);
        shoppingLists[contents.id].join(receivedList);
        const updateReply = {
          type: "update",
          message: `List ${contents.id} has been updated.`
        };
        sock.send([msg[0], "", JSON.stringify(updateReply)]);
        break;
      case "fetch":
        const list = shoppingLists[contents.id];
        const fetchReply = {
          type: "fetch",
          message: "List has been fetched.",
          list: list.toString()
        };
        sock.send([msg[0], "", JSON.stringify(fetchReply)]);
        break;
      default:
        const reply = {
          type: contents.type,
          message: `${contents.type} to you too`,
        };
        sock.send([msg[0], "", JSON.stringify(reply)]);
        break;
    }
  }
}

async function workerComms(listReceiver: zmq.Reply) {
  for await (const recieved of listReceiver) {
    try {
        const msg = JSON.parse(recieved.toString());
        console.log(msg);

        switch (msg.type) {
          case "killed":
            lists[msg.id] = msg.list;
            await listReceiver.send(JSON.stringify({type: "ACK"}));
            break;
          case "give":
            const reply = {list: lists[msg.id]};
            await listReceiver.send(JSON.stringify(reply));
            break;
          case "transfer":
            const toTransfer = {};
            const newNode = {};
            let transfered = 0;
            newNode[msg.id]= {vnodes: 5};
            const localHr = buildHashRing(JSON.parse(process.env.WORKERIDS));
            localHr.add(newNode);
            for (const list in lists) {
              const owner = localHr.get(list);
              if (owner == msg.id) {
                toTransfer[list] = lists[list];
                transfered++;
                delete lists[list];
              }
            }
            await listReceiver.send(JSON.stringify(toTransfer));
            break;
        }
    } catch (e) {
        console.error(e);
        listReceiver.send(JSON.stringify({type: "NACK"}));
    }
  }
}
