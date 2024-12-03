import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "e0ee7dee-e334-4216-a915-fd8fe2104e5a"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
