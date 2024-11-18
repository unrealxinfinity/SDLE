import * as zmq from "zeromq";
import cluster from "node:cluster";
import { v4 as uuidv4 } from "uuid";
import * as HashRing from "hashring";

const backAddr = "tcp://127.0.0.1:12345";
const frontAddr = "tcp://127.0.0.1:12346";
const clients = 10;
const workers = 10;
const availableWorkers = [];
const mapping = {};

async function clientProcess() {
  var sock = new zmq.Request();
  sock.connect(frontAddr);
  const createMsg = {
    type: "create",
  };

  await sock.send(JSON.stringify(createMsg));

  const msg = await sock.receive();
  console.log(`socket ${process.env.ID} recieved list id ${msg.toString()}`);

  const testMsg = {
    type: "wololo",
    list: msg.toString(),
  };

  await sock.send(JSON.stringify(testMsg));

  const secondMsg = await sock.receive();
  console.log(`socket ${process.env.ID} got a wololo ${secondMsg.toString()}`);

  sock.close();
  cluster.worker.kill();
}

async function workerProcess() {
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

async function frontend(frontSvr: zmq.Router, backSvr: zmq.Router, hashRing: HashRing) {
  for await (const msg of frontSvr) {
    const contents = JSON.parse(msg[2].toString());

    if (contents.type == "create") {
      const listID = uuidv4();

      frontSvr.send([msg[0], "", listID]);
    } else {
      /*const interval = setInterval(() => {
        //console.log(availableWorkers);
        if (availableWorkers.length > 0) {
          backSvr.send([availableWorkers.shift(), "", msg[0], "", msg[2]]);
          clearInterval(interval);
        }
      }, 10);*/

      const responsible = hashRing.get(contents.list);
      const interval = setInterval(() => {
        if (mapping[responsible] === false) {
          mapping[responsible] = true;
          backSvr.send([responsible, "", msg[0], "", msg[2]]);
          clearInterval(interval);
        }
      }, 10);
    }
  }
}

async function backend(backSvr: zmq.Router, frontSvr: zmq.Router) {
  for await (const msg of backSvr) {
    /*availableWorkers.push(msg[0]);
    if (msg[2].toString() !== "READY") {
      frontSvr.send([msg[2], msg[3], msg[4]]);
    }*/
    const contents = JSON.parse(msg[msg.length - 1].toString());

    if (contents.type === "ready") {
      console.log("i got a ready");
      mapping[msg[0].toString()] = false;
      /*mapping[contents.list] = {
        id: msg[0],
        busy: false,
      };*/
    } else {
      mapping[msg[0].toString()].busy = false;
      frontSvr.send([msg[2], msg[3], msg[4]]);
    }
  }
}

async function loadBalancer(hashRing: HashRing) {
  const backSvr = new zmq.Router();
  //backSvr.identity = 'backSvr' + process.pid
  await backSvr.bind(backAddr);
  const frontSvr = new zmq.Router();
  await frontSvr.bind(frontAddr);

  await Promise.all([frontend(frontSvr, backSvr, hashRing), backend(backSvr, frontSvr)]);
}

// Example is finished.
// Node process management noise below
if (cluster.isPrimary) {
  // create the workers and clients.
  // Use env variables to dictate client or worker

  // @ts-expect-error
  const hashRing = new HashRing.default([]) as HashRing;

  for (var i = 0; i < workers; i++) {
    const id = uuidv4();
    hashRing.add(id);
    mapping[id] = true;
    cluster.fork({
      TYPE: "worker",
      ID: id
    });
  }
  /*for (var i = 0; i < clients; i++)
    cluster.fork({
      TYPE: "client",
      ID: i,
    });*/

  cluster.on("death", function (worker) {
    console.log("worker " + worker.pid + " died");
  });

  var deadClients = 0;
  cluster.on("disconnect", function (worker) {
    deadClients++;
    if (deadClients === clients) {
      console.log("finished");
      process.exit(0);
    }
  });

  await loadBalancer(hashRing);
} else {
  if (process.env.TYPE === "client") {
    await clientProcess();
  } else {
    await workerProcess();
  }
}
