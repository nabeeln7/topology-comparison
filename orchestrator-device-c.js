/*
Study - num. of devices
Topology - Central (1)
 */
const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const fs = require('fs-extra');
const { spawn, execSync } = require('child_process');
const path = require('path');
const argv = require('yargs').argv;

function getRxBytes() {
    const result = execSync('cat /sys/class/net/wlan0/statistics/rx_bytes');
    return parseInt(result.toString());
}

function getTxBytes() {
    const result = execSync('cat /sys/class/net/wlan0/statistics/tx_bytes');
    return parseInt(result.toString());
}

function getCpuRecorder(logFileName) {
    const process = spawn('pidstat', ['-H', '-p', 'ALL', '-h', '-l', '-u', '-C', 'node', '1']);
    console.log(`[cpu-recorder] started recording to ${logFileName}`);
    const logStream = fs.createWriteStream(path.join(__dirname, 'data', logFileName), {flags: 'w'});
    process.stdout.pipe(logStream);
    process.stderr.pipe(logStream);

    process.on('close', (code) => {
        console.log(`[cpu-recorder] finished recording to ${logFileName}`);
        logStream.end();
    });
    return process;
}

function getMemoryRecorder(logFileName) {
    const process = spawn('../memory-recorder.sh');
    console.log(`[memory-recorder] started recording to ${logFileName}`);
    const logStream = fs.createWriteStream(path.join(__dirname, 'data', logFileName), {flags: 'w'});
    process.stdout.pipe(logStream);
    process.stderr.pipe(logStream);

    process.on('close', (code) => {
        console.log(`[memory-recorder] finished recording to ${logFileName}`);
        logStream.end();
    });
    return process;
}

function setupDeviceEvaluationEnvironment(allIps, numDevices, streamingRate, payloadSize, recipientMqttBrokerIp) {
    // send request to all gateways and PFs to setup their devices
    const data = { // TODO
        "numDevices": numDevices,
        "streamingRateSec": streamingRate,
        "payloadSizeKB": payloadSize,
        "recipientMqttBrokerIp": recipientMqttBrokerIp
    };

    allIps.forEach(ip => {
        mqttController.publish(ip, 'orchestrator', JSON.stringify(data));
    });
}

const gatewayIp = ''; // TODO
const allIps = []; // TODO

// for i = 0 to 100, step by 10
//      start cpu and memory recording to output files cpu-{i}-devices, mem-{i}-devices
//      add 5 devices
//      wait for 5 minutes

// number of devices increases from 0 to 1000 at steps of 50

/*
command line arguments:
numDevicesStart - number of devices starting value
numDevices - number of devices
numDevicesStep - step of how many devices to evaluate
recordTimeSec - how long to do the cpu and memory usage recording
payloadSizeKB - virtual sensor payload size
streamingRateSec - virtual sensor streaming rate
 */

let i= argv.numDevicesStart;
const loopEnd = argv.numDevices;
const loopStep = argv.numDevicesStep;

let cpuRecorderProcess;
let memRecorderProcess;
const recordTime = argv.recordTimeSec * 60 * 1000;

const streamingRateMillis = argv.streamingRateSec * 1000;
const payloadSizeBytes = argv.payloadSizeKB * 1000;

const nwTrafficLogFileName = 'nw-traffic.csv'; // 0,1000 1,2000,.....
const stream = fs.createWriteStream(nwTrafficLogFileName, {flags:'a'});
const nwTraffic = {};
let prevRxBytes;
let prevTxBytes;

function performProfiling() {
    // kill old recorders
    if(cpuRecorderProcess) {
        cpuRecorderProcess.kill();
    }
    if(memRecorderProcess) {
        memRecorderProcess.kill();
    }

    if(!prevTxBytes) {
        prevRxBytes = getRxBytes();
        prevTxBytes = getTxBytes();
    } else {
        const currRxBytes = getRxBytes();
        const currTxBytes = getTxBytes();

        const totalRxBytes = currRxBytes - prevRxBytes;
        const totalTxBytes = currTxBytes - prevTxBytes;
        const totalBytes = totalRxBytes + totalTxBytes;

        prevRxBytes = currRxBytes;
        prevTxBytes = currTxBytes;

        stream.write(`${i},${totalBytes}\n`);
    }

    console.log("killed old recorders");

    // check if we're done
    if(i > loopEnd) {
        clearTimeout(timer);
        console.log("we're done!");
        stream.end();
        return;
    }

    // start recording the cpu and memory usage
    const cpuLogFileName = `cpu-${i}-devices.log`;
    const memLogFileName = `mem-${i}-devices.log`;

    cpuRecorderProcess = getCpuRecorder(cpuLogFileName);
    memRecorderProcess = getMemoryRecorder(memLogFileName);

    console.log("started new recorders");
    setupDeviceEvaluationEnvironment(allIps, i, streamingRateMillis, payloadSizeBytes, gatewayIp);

    i += loopStep;
}

fs.ensureDirSync(path.join(__dirname, 'data'));
performProfiling();
const timer = setInterval(() => {
    performProfiling();
}, recordTime);