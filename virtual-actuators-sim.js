const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;
const fs = require('fs');
const path = require('path');

// actuator always listens to the local mqtt broker. apps need to send a formatted msg to the PF's mqtt broker under the
// topic 'act-msgs'.

const stream = fs.createWriteStream(path.join(__dirname, 'data', `actuator-latency.csv`), {flags:'w'});
stream.write(`# deviceId,latency (ms)\n`);

mqttController.subscribe('localhost', 'act-msgs',message => {
    const data = JSON.parse(message);
    const deviceId = data['id'];

    // measure application latency here
    const latency = Date.now() - data['ts'];
    stream.write(`${latency}\n`);
});

