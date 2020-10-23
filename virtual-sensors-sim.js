const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;
const path = require('path');
const fs = require('fs-extra');
const {getRxBytes, getTxBytes} = require('./nw-traffic-profiler');

let interval;

const mqttBrokerIps = argv.recipientMqttBrokerIps.split(",");

mqttController.subscribe('localhost', 'orchestrator', message => {
    // const data = {
    //     "startDeviceId": 0,
    //     "endDeviceId": 99,
    //     "streamingRateSec": 1,
    //     "payloadSizeKB": 1
    // };
    const data = JSON.parse(message);

    clearInterval(interval);
    console.log('stopped streaming with prev params.');

    if(data.hasOwnProperty('stop')) {
        process.exit(1);
    } else if(!data.hasOwnProperty('start')) {
        const startDeviceId = data.startDeviceId;
        const endDeviceId = data.endDeviceId;
        const numDevices = endDeviceId - startDeviceId + 1;
        const streamingRateMillis = data.streamingRateMillis;
        const payloadSizeBytes = data.payloadSizeBytes;

        console.log('new orchestration parameters received.');
        console.log(`startDeviceId = ${startDeviceId}, endDeviceId = ${endDeviceId}, streamingRateMillis = ${streamingRateMillis}, 
        payloadSizeBytes = ${payloadSizeBytes}`);

        if(numDevices > 0) {
            interval = setInterval(() => {
                for (let i = startDeviceId; i <= endDeviceId; i++) {
                    const deviceId = `virtualSensor${i}`;

                    const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
                    const sendStr = str100Bytes.repeat(payloadSizeBytes / 100);

                    const data = {
                        "id": deviceId,
                        "ts": Date.now().toString(),
                        "data": sendStr
                    };
                    mqttBrokerIps.forEach(mqttBrokerIp => {
                        mqttController.publish(mqttBrokerIp, 'topo-data', JSON.stringify(data));
                    });
                }
            }, streamingRateMillis);
            console.log('started streaming.');
        }
    }
});