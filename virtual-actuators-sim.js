const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;

// actuator always listens to the local mqtt broker. apps need to send a formatted msg to the PF's mqtt broker under the
// topic 'act-msgs'.

mqttController.subscribe('localhost', 'act-msgs',message => {
    const data = JSON.parse(message);
    const deviceId = data['actuatorId']; // expect actuatorId to be 0 -> n

    console.log(`processing message for actuator id ${deviceId}`);

    // measure application latency here
    const startTs = data['ts'];
    const latency = Date.now() - startTs;
    console.log(`${startTs},${latency}`);
});

