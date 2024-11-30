import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "add"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
