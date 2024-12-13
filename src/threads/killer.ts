import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "93fece4e-a626-46a8-9159-dc62a4d1ca35"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
