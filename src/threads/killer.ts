import * as zmq from "zeromq";

const frontAddr = "tcp://127.0.0.1:12346";

async function clientProcess() {
    var sock = new zmq.Request();
    sock.connect(frontAddr);
    const createMsg = {
        type: "kill",
        id: "4ee42f90-be5f-40cb-81ed-2ad4b39fd1a0"
    };

    await sock.send(JSON.stringify(createMsg));

    sock.close();
}

clientProcess();
