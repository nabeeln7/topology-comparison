/*
App2: Intruder detection in secure areas of building
Camera feed - detect object - alert
Input: All cameras
 */

// listen to mqtt for its app id as env variable
const MqttController = require("../mqtt-controller"); // one level above deployed-apps
const mqttController = MqttController.getInstance();
const applicationTopic = process.env.TOPIC; // receive the application's topic as an environment variable
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const appUtils = require('../app-utils');

const shouldComputeLatency = true;

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

const uvicorn = spawn('/usr/local/bin/uvicorn', ['application.server.main:app', '--host', '0.0.0.0'], {
    cwd: '/root/tensorflow-fastapi-starter-pack'
});

// let actuatorIds = [];
let stream;

if(shouldComputeLatency) {
    stream = fs.createWriteStream(path.join(__dirname, '..', 'data', `${applicationTopic}-latency.csv`), {flags: 'w'});
    // stream.write(`# latency (ms)\n`);
}

let currentWindow = [];

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

    currentWindow.push(data);

    // if(data.hasOwnProperty('setup')) {
    // actuatorIds = data['actuatorIds'];
    // console.log(`received actuatorIds. actuatorIds = ${actuatorIds}`);
    // } else {
    // }
});

// const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
// const sendStr = str100Bytes.repeat(10);

setInterval(() => {
    // send an http request to the uvicorn webapp
    const id = getRandomInt(7);
    appUtils.sendImage('localhost', `../sample-images/${id}.jpg`);

    // clear current window
    currentWindow = [];

}, 30000);