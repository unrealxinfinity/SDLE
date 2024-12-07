import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "ad7d4c2f-815e-4f2a-8d7c-c181b3059f5a"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
