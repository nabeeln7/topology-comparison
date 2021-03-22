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

function simulateDeviceClass(deviceIds, streamingRateMillis, payloadSizeBytes) {
    if(deviceIds.length == 0) {
        return;
    }
    
    deviceIds.forEach(deviceId => {
        // get a random int millis < streaming rate. eg., if rate = 5mins, start anytime from now until 5 mins
        const randomDelay = getRandomInt(streamingRateMillis);

        setIntervalAfterDelay(() => {
            simulateDevice(deviceId, payloadSizeBytes);
        }, streamingRateMillis, randomDelay);

        console.log(`Stream ${deviceId} every ${streamingRateMillis}ms. Start it after ${randomDelay}ms.`)
    });
    console.log(`finished scheduling all devices for ${deviceIds}`);
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

        // get the set of device ids to simulate as json
        // {
        //     deviceIds: ["s1", "s2", ...]
        // }
        // iterate through list, identify prefix and sim that device class

        const deviceIds = data.deviceIds;
        const smIds = [], tempIds = [], occupIds = [], co2Ids = [], camIds = [];
        deviceIds.forEach(deviceId => {
            if(deviceId.startsWith("sm")){
                smIds.push(deviceId);
            } else if(deviceId.startsWith("temp")){
                tempIds.push(deviceId);
            } else if(deviceId.startsWith("occup")){
                occupIds.push(deviceId);
            } else if(deviceId.startsWith("co2")){
                co2Ids.push(deviceId);
            } else if(deviceId.startsWith("cam")){
                camIds.push(deviceId);
            } 
        });

        simulateDeviceClass(smIds, smartMeterStreamMs, smartMeterPayloadBytes);
        simulateDeviceClass(tempIds, tempStreamMs, tempPayloadBytes);
        simulateDeviceClass(occupIds, occupStreamMs, occupPayloadBytes);
        simulateDeviceClass(co2Ids, co2StreamMs, co2PayloadBytes);
        simulateDeviceClass(camIds, camStreamMs, camPayloadBytes);
    }
});