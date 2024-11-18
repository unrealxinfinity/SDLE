import * as zmq from "zeromq";
import cluster from "node:cluster";

const frontAddr = "tcp://127.0.0.1:12346";

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
    //cluster.worker.kill();
}

clientProcess();
