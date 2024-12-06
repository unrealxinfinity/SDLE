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

async function syncList(list: string) {
  const workers = JSON.parse(process.env.WORKERIDS);
  const owners = hr.range(list, 3);

  for (const owner of owners) {
    if (owner === process.env.ID) continue;
    const requester = new zmq.Request();
    requester.connect(`tcp://127.0.0.1:${workers[owner]}`);

    const request = {
      type: "sync",
      id: list,
      list: shoppingLists[list].toJSON()
    };
  
    await requester.send(JSON.stringify(request));
  
    const msg = JSON.parse(((await requester.receive()).toString()));
    if (msg.list) {
      shoppingLists[list].join(PNShoppingMap.fromJSON(msg.list));
    }
  }
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

    const reply = JSON.parse(((await requester.receive()).toString()));;
    for (const list in reply) {
      if (!(list in shoppingLists)) shoppingLists[list] = PNShoppingMap.fromJSON(reply[list], null, list);
      else shoppingLists[list].join(PNShoppingMap.fromJSON(reply[list], null , list));
    }
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

  const msg = JSON.parse(((await requester.receive()).toString()));
  if (msg.list) {
    shoppingLists[listID] = PNShoppingMap.fromJSON(msg.list);
    return true;
  }
  return false;
}

async function processRequests(sock: zmq.Request) {
  for await (const msg of sock) {
    const contents = JSON.parse(msg[2].toString());
    
    process.env.WORKERIDS = JSON.stringify(contents.workerIds);
    hr = buildHashRing(contents.workerIds);
    console.log(process.env.ID, contents.id);

    try {
      switch (contents.type) {
        case "kill":
          for (const list in shoppingLists) {
            const responsible = hr.get(list);
            const sender = new zmq.Request();
            console.log(
              `tcp://127.0.0.1:${contents.workerIds[responsible]}`
            );
            sender.connect(
              `tcp://127.0.0.1:${contents.workerIds[responsible]}`
            );

            while (true) {
              const msg = { id: list, list: shoppingLists[list].toJSON(), type: "killed" };
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
          if (!(contents.id in shoppingLists)) {
            shoppingLists[contents.id] = receivedList;
          }
          else {
            shoppingLists[contents.id].join(receivedList);
          }
          const updateReply = {
            type: "update",
            message: `List ${contents.id} has been updated.`
          };
          sock.send([msg[0], "", JSON.stringify(updateReply)]);
          break;
        case "fetch":
          let list = shoppingLists[contents.id];
          if (!list) {
            const workers = JSON.parse(process.env.WORKERIDS);

            for (const owner of hr.range(contents.id, 3)) {
              if (owner === process.env.ID) continue;

              if (await cacheMiss(workers[owner], contents.id) === true) {
                list = shoppingLists[contents.id];
                break;
              } 
            }
          }

          if (!list) throw new Error("List could not be fetched.");

          const fetchReply = {
            type: "fetch",
            message: "List has been fetched.",
            list: list.toJSON()
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
    } catch (e) {
      sock.send([msg[0], "", JSON.stringify({type: "error", message: "Error in operation."})]);
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
            shoppingLists[msg.id] = PNShoppingMap.fromJSON(msg.list, null, msg.id);

            await listReceiver.send(JSON.stringify({type: "ACK"}));
            break;
          case "give":
            const reply = {list: shoppingLists[msg.id]?.toJSON()};
            await listReceiver.send(JSON.stringify(reply));
            break;
          case "sync":
            if (!(msg.id in shoppingLists)) {
              shoppingLists[msg.id] = PNShoppingMap.fromJSON(msg.list, null, msg.id);
            }
            shoppingLists[msg.id].join(PNShoppingMap.fromJSON(msg.list, null, msg.id));
            const syncReply = {list: shoppingLists[msg.id].toJSON()};
            await listReceiver.send(JSON.stringify(syncReply));
            break;
          case "transfer":
            const toTransfer = {};
            const newNode = {};
            newNode[msg.id]= {vnodes: 5};
            const localHr = buildHashRing(JSON.parse(process.env.WORKERIDS));
            localHr.add(newNode);
            for (const list in shoppingLists) {
              const owners = localHr.range(list, 3);
              if (owners.includes(msg.id)) {
                toTransfer[list] = shoppingLists[list];
                delete shoppingLists[list];
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
