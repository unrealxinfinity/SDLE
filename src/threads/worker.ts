import * as HashRing from "hashring";
import * as zmq from "zeromq";

const backAddr = "tcp://127.0.0.1:12345";
const lists = {};
lists[`${process.env.ID}-testlist`] = { banana: 1 };
lists[`${process.env.ID}-testlist2`] = { apples: 3 };

function buildHashRing(ids: any): HashRing {
  // @ts-expect-error
  const hashRing = new HashRing.default([], "md5", { replicas: 1 }) as HashRing;

  for (const id in ids) {
    if (id === process.env.ID) {
      continue;
    }
    const node = {};
    node[id] = { vnodes: 1 };
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

  await Promise.all([processRequests(sock), workerComms(listReceiver)]);
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
  let hr: HashRing | null = null;

  for await (const msg of sock) {
    const contents = JSON.parse(msg[2].toString());
    console.log(process.env.ID, contents);
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
            if (rep.toString() === "ACK") break;
          }
        }
        
        const confirmation = {type: "i am dead"}
        sock.send([msg[0], "", JSON.stringify(confirmation)]);
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
        }

        listReceiver.send("ACK");
    } catch {
        listReceiver.send("NACK");
    }
  }
}
