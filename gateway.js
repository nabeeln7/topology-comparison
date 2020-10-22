// TODO: simulate the delay from device to packet forwarder or device to gateway?
const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();

// listen to topo-data for any new data
mqttController.subscribeToPlatformMqtt(message => {
    console.log('received new data');
});
