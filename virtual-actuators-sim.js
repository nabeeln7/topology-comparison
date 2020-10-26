const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;
const fs = require('fs');
const path = require('path');

// actuator always listens to the local mqtt broker. apps need to send a formatted msg to the PF's mqtt broker under the
// topic 'act-msgs'.

let stream;

mqttController.subscribe('localhost', 'act-msgs',message => {
    const data = JSON.parse(message);

    if(data.hasOwnProperty('start')) {
        stream = fs.createWriteStream(path.join(__dirname, 'data', `actuator-latency.csv`), {flags:'w'});
        stream.write(`# latency (ms)\n`);
    } else if(data.hasOwnProperty('stop')) {
        stream.end();
        process.exit(1);
    } else {
        // measure application latency here
        const latency = Date.now() - data['ts'];
        stream.write(`${latency}\n`);
    }
});

