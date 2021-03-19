const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;

const smartMeterStreamMs = 1000;
const smartMeterPayloadBytes = 500;

const tempStreamMs = 300000;
const tempPayloadBytes = 100;

const occupStreamMs = 300000;
const occupPayloadBytes = 100;

const co2StreamMs = 900000;
const co2PayloadBytes = 100;

const camStreamMs = 1000;
const camPayloadBytes = 100000;

var timers = [];

function simulateDevice(deviceIdPrefix, streamingRateMillis, payloadSizeBytes, count) {
    const timer = setInterval(() => {
        for (let i = 0; i <= count; i++) {
            const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
            const sendStr = str100Bytes.repeat(payloadSizeBytes / 100);

            const data = {
                "id": `${deviceIdPrefix}${i.toString()}`,
                "ts": Date.now(),
                "data": sendStr
            };
            mqttBrokerIps.forEach(mqttBrokerIp => {
                mqttController.publish(mqttBrokerIp, 'topo-data', JSON.stringify(data));
            });
        }
    }, streamingRateMillis);
    console.log(`started streaming for ${deviceIdPrefix}`);

    timers.push(timer);
}

let interval;

const mqttBrokerIps = argv.recipientMqttBrokerIps.split(",");

mqttController.subscribe('localhost', 'orchestrator', message => {
    // const data = {
    //     "startDeviceId": 0,
    //     "endDeviceId": 99,
    //     "streamingRateSec": 1,
    //     "payloadSizeKB": 1
    // };
    const data = JSON.parse(message.toString());

    timers.forEach(timer => {
        clearInterval(timer);    
    });

    timers = [];
    
    console.log('stopped streaming with prev params.');

    if(data.hasOwnProperty('stop')) {
        process.exit(1);
    } else if(!data.hasOwnProperty('start')) {
        // simulateDevice(deviceIdPrefix, streamingRateMillis, payloadSizeBytes, count)
        simulateDevice('sm', smartMeterStreamMs, smartMeterPayloadBytes, 10);
        simulateDevice('temp', tempStreamMs, tempPayloadBytes, 50);
        simulateDevice('occup', occupStreamMs, occupPayloadBytes, 50);
        simulateDevice('co2', co2StreamMs, co2PayloadBytes, 10);

        // TODO stream only when you have an app
        // simulateDevice('cam', camStreamMs, camPayloadBytes, 10);

    }
});