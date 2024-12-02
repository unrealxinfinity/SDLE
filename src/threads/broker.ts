import * as zmq from "zeromq";
import cluster from "node:cluster";
import { v4 as uuidv4 } from "uuid";
import * as HashRing from "hashring";
import workerProcess from "./worker.js";

const backAddr = "tcp://127.0.0.1:12345";
const frontAddr = "tcp://127.0.0.1:12346";
const clients = 10;
const workers = 10;
const workerIds = {};
const mapping = {};
const basePort = 5000;
let lastUsedPort = 0;

enum WorkerState {
  BUSY,
  READY,
  DYING,
  STARTING
}

function sendMessageOnInterval(msg: any, id: string, sockMsg: Buffer[], backSvr: zmq.Router, frontSvr: zmq.Router) {
  const interval = setInterval(async () => {
    if (mapping[id] === WorkerState.DYING || mapping[id] == WorkerState.STARTING) {
      frontSvr.send([
        sockMsg[0],
        "",
        "The system is undergoing maintenance. Retry in a few seconds."
      ]);
    }
    else if (mapping[id] === WorkerState.READY) {
      mapping[id] = WorkerState.BUSY;
      backSvr.send([
        id,
        "",
        sockMsg[0],
        "",
        msg
      ]);
      clearInterval(interval);
    }
  }, 10);
}

async function frontend(
  frontSvr: zmq.Router,
  backSvr: zmq.Router,
  hashRing: HashRing
) {
  for await (const msg of frontSvr) {
    const contents = JSON.parse(msg[2].toString());

    switch (contents.type) {
      case "create":
        const listID = uuidv4();

        frontSvr.send([msg[0], "", listID]);
        break;
      case "kill":
        contents.workerIds = workerIds;
        sendMessageOnInterval(JSON.stringify(contents), contents.id, msg, backSvr, frontSvr);
        /*const killInterval = setInterval(() => {
          if (mapping[contents.id] === WorkerState.READY) {
            mapping[contents.id] = WorkerState.BUSY;
            backSvr.send([
              contents.id,
              "",
              msg[0],
              "",
              JSON.stringify(contents),
            ]);
            clearInterval(killInterval);
          }
        }, 10);*/
        break;
      case "add":
        const id = uuidv4();
        const node = {};
        lastUsedPort++;
        const port = basePort + lastUsedPort;

        node[id] = { vnodes: 5 };
        workerIds[id] = port;
        hashRing.add(node);
        mapping[id] = WorkerState.STARTING;
        cluster.fork({
          TYPE: "worker",
          ID: id,
          PORT: port,
          WORKERIDS: JSON.stringify(workerIds)
        });
        break;
      default:
        contents.workerIds = workerIds;
        const responsible = hashRing.get(contents.id);
        sendMessageOnInterval(JSON.stringify(contents), responsible, msg, backSvr, frontSvr);
    }
  }
}

async function backend(backSvr: zmq.Router, frontSvr: zmq.Router, hashRing: HashRing) {
  for await (const msg of backSvr) {
    /*availableWorkers.push(msg[0]);
    if (msg[2].toString() !== "READY") {
      frontSvr.send([msg[2], msg[3], msg[4]]);
    }*/
    const contents = JSON.parse(msg[msg.length - 1].toString());

    switch (contents.type) {
      case "ready":
        console.log("i got a ready");
        mapping[msg[0].toString()] = WorkerState.READY;
        break;
      case "i am dead":
        console.log("someone died");
        hashRing.remove(msg[0].toString());
        delete workerIds[msg[0].toString()];
        break;
      default:
        mapping[msg[0].toString()] = WorkerState.READY;
        frontSvr.send([msg[2], msg[3], msg[4]]);
        break;
    }
  }
}

async function loadBalancer(hashRing: HashRing) {
  const backSvr = new zmq.Router();
  //backSvr.identity = 'backSvr' + process.pid
  await backSvr.bind(backAddr);
  const frontSvr = new zmq.Router();
  await frontSvr.bind(frontAddr);

  await Promise.all([
    frontend(frontSvr, backSvr, hashRing),
    backend(backSvr, frontSvr, hashRing),
  ]);
}

// Example is finished.
// Node process management noise below
if (cluster.isPrimary) {
  // create the workers and clients.
  // Use env variables to dictate client or worker

  // @ts-expect-error
  const hashRing = new HashRing.default([], "md5", { replicas: 1 }) as HashRing;

  for (var i = 0; i < workers; i++) {
    lastUsedPort = i;
    const id = uuidv4();
    const node = {};
    const port = basePort + i;

    node[id] = { vnodes: 5 };
    workerIds[id] = port;
    hashRing.add(node);
    mapping[id] = WorkerState.BUSY;
  }
  for (const id in workerIds) {
    cluster.fork({
      TYPE: "worker",
      ID: id,
      PORT: workerIds[id],
      WORKERIDS: JSON.stringify(workerIds),
      INITIAL: true
    })
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
  } else {
    await workerProcess();
  }
}
