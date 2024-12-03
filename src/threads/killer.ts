import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "b413e77c-7df3-4542-8cf8-7c1656da3409"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
