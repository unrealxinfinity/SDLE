import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "086cc037-9a2f-4c93-a2f9-2fd057d819ce"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
