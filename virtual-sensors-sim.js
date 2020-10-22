const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;
const path = require('path');
const fs = require('fs-extra');
const { getRxBytes, getTxBytes } = require('./nw-traffic-profiler');

let interval;

fs.ensureDirSync(path.join(__dirname, 'pf-data'));
fs.emptyDirSync(path.join(__dirname, 'pf-data'));
const nwTrafficLogFileName = 'nw-traffic.csv'; // 0,1000 1,2000,.....
const stream = fs.createWriteStream(path.join(__dirname, 'pf-data', nwTrafficLogFileName), {flags:'a'});
let prevRxBytes;
let prevTxBytes;
let prevNumDevices;

mqttController.subscribe('localhost', 'orchestrator', message => {
    // const data = {
    //     "numDevices": 10,
    //     "streamingRateSec": 1,
    //     "payloadSizeKB": 1,
    //     "recipientMqttBrokerIp": '172.27.45.26'
    // };
    const data = JSON.parse(message);

    clearInterval(interval);
    console.log('stopped streaming with prev params.');

    if(data.hasOwnProperty('stop')) {
        stream.end();
        process.exit(1);
    } else {
        let numDevices = data.numDevices;
        const streamingRateMillis = data.streamingRateSec * 1000;
        const payloadSizeBytes = data.payloadSizeKB * 1000;
        const mqttBrokerIp = data.recipientMqttBrokerIp;

        console.log('new orchestration parameters received.');
        console.log(`numDevices = ${numDevices}, streamingRateMillis = ${streamingRateMillis}, payloadSizeBytes = ${payloadSizeBytes}, 
        mqttBrokerIp = ${mqttBrokerIp}`);

        // measure nw traffic
        if(!prevTxBytes) {
            prevRxBytes = getRxBytes();
            prevTxBytes = getTxBytes();
            prevNumDevices = numDevices;
        } else {
            const currRxBytes = getRxBytes();
            const currTxBytes = getTxBytes();

            const totalRxBytes = currRxBytes - prevRxBytes;
            const totalTxBytes = currTxBytes - prevTxBytes;
            const totalBytes = totalRxBytes + totalTxBytes;

            stream.write(`${prevNumDevices},${totalBytes}\n`);

            prevRxBytes = currRxBytes;
            prevTxBytes = currTxBytes;
            prevNumDevices = numDevices;
        }

        if(numDevices > 0) {
            interval = setInterval(() => {
                for(let i=0; i<numDevices; i++) {
                    const deviceId = `virtualSensor${i}`;

                    const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
                    const sendStr = str100Bytes.repeat(payloadSizeBytes / 100);

                    const data = {
                        "id": deviceId,
                        "ts": Date.now().toString(),
                        "data": sendStr
                    };
                    mqttController.publish(mqttBrokerIp, 'topo-data', JSON.stringify(data));
                }
            }, streamingRateMillis);
            console.log('started streaming.');
        }
    }
});