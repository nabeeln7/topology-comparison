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
var delayTimers = [];

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

function setIntervalAfterDelay(func, period, delay) {
    const delayTimer = setTimeout(() => {
        func();
        const timer = setInterval(func, period);
        timers.push(timer);
    }, delay);

    delayTimers.push(delayTimer);
}

function simulateDevice(deviceId, payloadSizeBytes) {
    const str100Bytes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor enim quis massa accumsan vel.';
    const sendStr = str100Bytes.repeat(payloadSizeBytes / 100);

    const data = {
        "id": deviceId,
        "ts": Date.now(),
        "data": sendStr
    };
    mqttBrokerIps.forEach(mqttBrokerIp => {
        mqttController.publish(mqttBrokerIp, 'topo-data', JSON.stringify(data));
    });
}

function simulateDeviceClass(gatewayId, deviceIdPrefix, streamingRateMillis, payloadSizeBytes, count) {
    for (let i = 0; i < count; i++) {
        const deviceId = `${gatewayId}${deviceIdPrefix}${i.toString()}`; // g0sm0 - g0sm9
        // get a random int millis < streaming rate. eg., if rate = 5mins, start anytime from now until 5 mins
        const randomDelay = getRandomInt(streamingRateMillis);

        setIntervalAfterDelay(() => {
            simulateDevice(deviceId, payloadSizeBytes);
        }, streamingRateMillis, randomDelay);

        console.log(`Stream ${deviceId} every ${streamingRateMillis}ms. Start it after ${randomDelay}ms.`)
    }
    console.log(`finished scheduling all devices for ${deviceIdPrefix}`);
}

const mqttBrokerIps = argv.recipientMqttBrokerIps.split(",");

mqttController.subscribe('localhost', 'orchestrator', message => {
    const data = JSON.parse(message.toString());

    timers.forEach(timer => {
        clearInterval(timer);    
    });
    timers = [];

    delayTimers.forEach(delayTimer => {
        clearTimeout(delayTimer);
    });
    delayTimers = [];
    
    console.log('cleared all previous timers and stopped streaming.');

    if(data.hasOwnProperty('stop')) {
        process.exit(1);
    } else if(data.hasOwnProperty('start')) {
        const gatewayId = data.gatewayId;

        // simulateDevice(deviceIdPrefix, streamingRateMillis, payloadSizeBytes, count)
        simulateDeviceClass(gatewayId, 'sm', smartMeterStreamMs, smartMeterPayloadBytes, 2);
        simulateDeviceClass(gatewayId, 'temp', tempStreamMs, tempPayloadBytes, 10);
        simulateDeviceClass(gatewayId, 'occup', occupStreamMs, occupPayloadBytes, 10);
        simulateDeviceClass(gatewayId, 'co2', co2StreamMs, co2PayloadBytes, 2);

        // TODO stream only when you have an app
        simulateDevice(gatewayId, 'cam', camStreamMs, camPayloadBytes, 1);

    }
});