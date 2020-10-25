// listen to mqtt for its app id as env variable
const MqttController = require("../mqtt-controller"); // one level above deployed-apps
const mqttController = MqttController.getInstance();
const applicationTopic = process.env.TOPIC; // receive the application's topic as an environment variable
const fs = require('fs');
const path = require('path');

let actuatorIds = [];
const stream = fs.createWriteStream(path.join(__dirname, '..', 'data', `${applicationTopic}-latency.csv`), {flags:'w'});
stream.write(`# latency (ms)\n`);

mqttController.subscribe('localhost', applicationTopic, message => {
    const data = JSON.parse(message);
    // const data = {
    //     "id": deviceId,
    //     "ts": Date.now(),
    //     "data": sendStr
    // };

    if(data.hasOwnProperty('setup')) {
        actuatorIds = data['actuatorIds'];
        console.log(`received actuatorIds. actuatorIds = ${actuatorIds}`);
    } else {
        const deviceId = data['id'];
        const latency = Date.now() - data['ts'];
        stream.write(`${latency}\n`);
    }
});

const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
const sendStr = str100Bytes.repeat(10);

setInterval(() => {
    actuatorIds.forEach(actuatorId => {

        const data = {
            "id": actuatorId,
            "ts": Date.now(),
            "data": sendStr
        };
        mqttController.publish('localhost', 'actuator-requests', JSON.stringify(data));
    })
}, 5000);