import * as zmq from "zeromq"
import cluster from "node:cluster"

const backAddr = 'tcp://127.0.0.1:12345'
const frontAddr = 'tcp://127.0.0.1:12346'
const clients = 10
const workers = 3;
const availableWorkers = [];

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    await sock.send(process.env.ID);
    const msg = await sock.receive();

    console.log(`socket ${process.env.ID} ended with ${msg.toString()}`);
    sock.close();
    cluster.worker.kill();
}

async function workerProcess() {
    const sock = new zmq.Request();
    sock.connect(backAddr);
    sock.send('READY');
  
    for await (const msg of sock) {
        sock.send([msg[0], '', `OK${msg[2].toString()}`]);
    }
}
  

async function frontend(frontSvr: zmq.Router, backSvr: zmq.Router) {
    for await (const msg of frontSvr) {
        const interval = setInterval(() => {
            //console.log(availableWorkers);
            if (availableWorkers.length > 0 ) {
                backSvr.send([availableWorkers.shift(), '', msg[0], '', msg[2]]);
                clearInterval(interval);
            }
        }, 10);
    }
}

async function backend(backSvr: zmq.Router, frontSvr: zmq.Router) {

    for await (const msg of backSvr) {
        availableWorkers.push(msg[0])
        if (msg[2].toString() !== "READY") {
            frontSvr.send([msg[2], msg[3], msg[4]])
        }
    }
}

async function loadBalancer() {
  const backSvr = new zmq.Router();
  //backSvr.identity = 'backSvr' + process.pid
  await backSvr.bind(backAddr);
  const frontSvr = new zmq.Router();
  await frontSvr.bind(frontAddr);

  await Promise.all([frontend(frontSvr, backSvr), backend(backSvr, frontSvr)]);
}

// Example is finished. 
// Node process management noise below
if (cluster.isPrimary) {
  // create the workers and clients.
  // Use env variables to dictate client or worker
  for (var i = 0; i < workers; i++) cluster.fork({
    "TYPE": 'worker'
  });
  for (var i = 0; i < clients; i++) cluster.fork({
    "TYPE": 'client',
    "ID": i
  });

  cluster.on('death', function(worker) {
    console.log('worker ' + worker.pid + ' died');
  });

  var deadClients = 0;
  cluster.on('disconnect', function(worker) {
    deadClients++
    if (deadClients === clients) {
      console.log('finished')
      process.exit(0)
    }
  });

  await loadBalancer();
} else {
  if (process.env.TYPE === 'client') {
    await clientProcess();
  } else {
    await workerProcess();
  }
}