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

async function frontend(frontSvr: zmq.Router, backSvr: zmq.Router, hashRing: HashRing) {
  for await (const msg of frontSvr) {
    const contents = JSON.parse(msg[2].toString());

    if (contents.type == "create") {
      const listID = uuidv4();

      frontSvr.send([msg[0], "", listID]);
    } else if (contents.type == "kill") {
      contents.workerIds = workerIds;
      const interval = setInterval(() => {
        if (mapping[contents.id] === false) {
          mapping[contents.id] = true;
          backSvr.send([contents.id, "", msg[0], "", JSON.stringify(contents)]);
          clearInterval(interval);
        }
      }, 10);
    } else {
      /*const interval = setInterval(() => {
        //console.log(availableWorkers);
        if (availableWorkers.length > 0) {
          backSvr.send([availableWorkers.shift(), "", msg[0], "", msg[2]]);
          clearInterval(interval);
        }
      }, 10);*/

      contents.workerIds = workerIds;
      const responsible = hashRing.get(contents.list);
      const interval = setInterval(() => {
        if (mapping[responsible] === false) {
          mapping[responsible] = true;
          backSvr.send([responsible, "", msg[0], "", JSON.stringify(contents)]);
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
      mapping[msg[0].toString()] = false;
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
  const hashRing = new HashRing.default([], 'md5', {"replicas": 1}) as HashRing;
  const basePort = 5000;

  for (var i = 0; i < workers; i++) {
    const id = uuidv4();
    const node = {};
    const port = basePort + i;

    node[id] = {"vnodes": 1};
    workerIds[id] = port;
    hashRing.add(node);
    mapping[id] = true;
    cluster.fork({
      TYPE: "worker",
      ID: id,
      PORT: port
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
    
  } else {
    await workerProcess();
  }
}
