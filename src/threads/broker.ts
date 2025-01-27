import * as zmq from "zeromq";
import cluster from "node:cluster";
import { v4 as uuidv4 } from "uuid";
import * as HashRing from "hashring";
import * as fs from 'fs';
import workerProcess from "./worker.js";
import { readJsonFile } from "../utills/files.js";
import 'dotenv/config';

const backAddr = "tcp://127.0.0.1:12345";
const frontAddr = "tcp://127.0.0.1:12346";
const workers = Number.parseInt(process.env.INITIALWORKERS);
const workerIds = {};
const mapping = {};
const basePort = 5000;
let lastUsedPort = 0;
const pids = {};

enum WorkerState {
  BUSY,
  READY,
  DYING,
  STARTING
}

function sendMessageOnInterval(msg: any, id: string, sockMsg: Buffer[], backSvr: zmq.Router, frontSvr: zmq.Router) {
  const interval = setInterval(() => {
    if (!(id in mapping) || mapping[id] === WorkerState.DYING || mapping[id] == WorkerState.STARTING) {
      frontSvr.send([
        sockMsg[0],
        "",
        "The system is undergoing maintenance. Retry in a few seconds."
      ]);
      clearInterval(interval);
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

function sendMessageOnIntervalRange(msg: any, ids: string[], sockMsg: Buffer[], backSvr: zmq.Router, frontSvr: zmq.Router) {
  const interval = setInterval(() => {
    for (const id of ids) {
      if (!(id in mapping) || mapping[id] === WorkerState.DYING || mapping[id] == WorkerState.STARTING) {
        frontSvr.send([
          sockMsg[0],
          "",
          "The system is undergoing maintenance. Retry in a few seconds."
        ]);
        clearInterval(interval);
        break;
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
        break;
      }
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
        const responsible = hashRing.range(contents.id, 3);
        sendMessageOnIntervalRange(JSON.stringify(contents), responsible, msg, backSvr, frontSvr);
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
        delete mapping[msg[0].toString()];
        break;
      default:
        mapping[msg[0].toString()] = WorkerState.READY;
        await frontSvr.send([msg[1], msg[2], msg[3]]);
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
  const loadedState = fs.existsSync("./serverStorage/broker.json") ? readJsonFile("./serverStorage/broker") : null;

  if (loadedState) {
    const loadedState = readJsonFile("./serverStorage/broker");
    lastUsedPort = loadedState.lastUsedPort;
    for (const worker in loadedState.workerIds) {
      workerIds[worker] = loadedState.workerIds[worker];

      const node = {};
      node[worker] = { vnodes: 5 };
      hashRing.add(node);
      mapping[worker] = WorkerState.BUSY;

      const forked = cluster.fork({
        TYPE: "worker",
        ID: worker,
        PORT: workerIds[worker],
        WORKERIDS: JSON.stringify(loadedState.workerIds),
        INITIAL: true
      });

      pids[forked.process.pid] = worker;
    }
  }
  else {
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
      const forked = cluster.fork({
        TYPE: "worker",
        ID: id,
        PORT: workerIds[id],
        WORKERIDS: JSON.stringify(workerIds),
        INITIAL: true
      });

      pids[forked.process.pid] = id;
    }
  }
  
  /*for (var i = 0; i < clients; i++)
    cluster.fork({
      TYPE: "client",
      ID: i,
    });*/

  cluster.on("disconnect", async function (worker) {
    console.log(worker.process.pid);
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (!(pids[worker.process.pid] in workerIds)) return;

    const forked = cluster.fork({
      TYPE: "worker",
      ID: pids[worker.process.pid],
      INITIAL: true
    });

    pids[forked.process.pid] = pids[worker.process.pid];
    delete pids[worker.process.pid];
  });

  setInterval(() => {
    fs.writeFileSync("./serverStorage/broker.json", JSON.stringify({workerIds, lastUsedPort}), 'utf8')
  }, 15000);

  await loadBalancer(hashRing);
} else {
  if (process.env.TYPE === "client") {
  } else {
    await workerProcess();
  }
}
