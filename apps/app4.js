/*
App 5: Room scheduling app
Checks the occupancy at each room and reports if room is in use or not
Inputs: occupancy sensors
 */

// listen to mqtt for its app id as env variable
const MqttController = require("../mqtt-controller"); // one level above deployed-apps
const mqttController = MqttController.getInstance();
const applicationTopic = process.env.TOPIC; // receive the application's topic as an environment variable
const fs = require('fs');
const path = require('path');

const shouldComputeLatency = true;

// let actuatorIds = [];
let stream;

if(shouldComputeLatency) {
    stream = fs.createWriteStream(path.join(__dirname, '..', 'data', `${applicationTopic}-latency.csv`), {flags: 'w'});
    // stream.write(`# latency (ms)\n`);
}

let currentWindow = [];
let windowItemCount = 0;
const windowItemMax = 50;

mqttController.subscribe('localhost', applicationTopic, message => {
    const data = JSON.parse(message);
    // const data = {
    //     "id": deviceId,
    //     "ts": Date.now(),
    //     "data": sendStr
    // };

    const currentTs = Date.now();

    if(shouldComputeLatency) {
        const deviceId = data['id'];
        const latency = currentTs - data['ts'];
        stream.write(`${latency}\n`);
    }

    if(windowItemCount < windowItemMax) {
        currentWindow.push(data);
    } else {
        // process current window
        const sum = currentWindow.reduce((a, b) => a.data.length + b.data.length, 0);
        console.log(sum);

        if(sum > 10000) {
            console.log('greater');
        }
        currentWindow = [];
        windowItemCount = 0;
    }
    // if(data.hasOwnProperty('setup')) {
    // actuatorIds = data['actuatorIds'];
    // console.log(`received actuatorIds. actuatorIds = ${actuatorIds}`);
    // } else {
    // }
});

// const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
// const sendStr = str100Bytes.repeat(10);

// setInterval(() => {
//     actuatorIds.forEach(actuatorId => {

//         const data = {
//             "id": actuatorId,
//             "ts": Date.now(),
//             "data": sendStr
//         };
//         mqttController.publish('localhost', 'actuator-requests', JSON.stringify(data));
//     })
// }, 15000);