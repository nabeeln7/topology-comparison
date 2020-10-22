const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const argv = require('yargs').argv;

let interval;

mqttController.subscribe('localhost', 'orchestrator', message => {
    // const data = {
    //     "numDevices": 10,
    //     "streamingRateSec": 1,
    //     "payloadSizeKB": 1,
    //     "recipientMqttBrokerIp": '172.27.45.26'
    // };
    const data = JSON.parse(message);

    let numDevices = data.numDevices;
    const streamingRateMillis = data.streamingRateSec * 1000;
    const payloadSizeBytes = data.payloadSizeKB * 1000;
    const mqttBrokerIp = data.recipientMqttBrokerIp;

    console.log('new orchestration parameters received.');
    console.log('stopped streaming with prev params.');
    console.log(`numDevices = ${numDevices}, streamingRateMillis = ${streamingRateMillis}, 
    payloadSizeBytes = ${payloadSizeBytes}, mqttBrokerIp = ${mqttBrokerIp}`);
    clearInterval(interval);

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
});