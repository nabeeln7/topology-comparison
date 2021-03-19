/*
Study - num. of devices
Topology - Central (1)
 */
const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');
const argv = require('yargs').argv;
const { getRxBytes, getTxBytes } = require('./nw-traffic-profiler');

function getCpuRecorder(logFileName) {
    const process = spawn('sar', ['-u', '1']); // Report CPU utilization every sec.
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
    const process = spawn('./memory-recorder.sh');
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

function terminateSensorStreams(packetForwarderIps) {
    // send request to all PFs to stop evaluation
    const data = {
        "stop": true
    };

    packetForwarderIps.forEach(ip => {
        mqttController.publish(ip, 'orchestrator', JSON.stringify(data));
    });
}

function setupSensorStreamAtGateway(gatewayId, gatewayIp) {
    const data = {
        "start": true,
        "gatewayId": gatewayId
    };
    mqttController.publish(gatewayIp, 'orchestrator', JSON.stringify(data));
    console.log(`requested ${gatewayId} to send streams`);
}

// for i = 0 to GATEWAY_COUNT, step by 1
//      start cpu and memory recording to output files cpu-{i}-gateways, mem-{i}-gateways
//      add all devices at that gateway
//      wait for 10 minutes

/*
command line arguments:
virtualSensorOrchestrate - whether to start other gateways' sensor-sim script or not
forwarderIps - ip of all gateways/pf with sensor-sim
 */

const virtualSensorOrchestrate = argv.virtualSensorOrchestrate === 'true';
const recordTimeMillis = argv.recordTimeMillis;

let packetForwarderIps = [];
if(virtualSensorOrchestrate) {
    packetForwarderIps = argv.forwarderIps.split(",");
}

let cpuRecorderProcess;
let memRecorderProcess;

fs.ensureDirSync(path.join(__dirname, 'data'));
fs.emptyDirSync(path.join(__dirname, 'data'));
const nwTrafficLogFileName = 'nw-traffic.csv'; // 0,1000 1,2000,.....
const stream = fs.createWriteStream(path.join(__dirname, 'data', nwTrafficLogFileName), {flags:'w'});
stream.write(`# record time (ms) = ${recordTimeMillis}\n`);
stream.write(`# numGateways,totalTxBytes,totalRxBytes,totalBytes\n`);
let prevTxBytes;
let prevRxBytes;

// loop from no gateways (i=-1) until packetforwarders.length (i=pf.length)
let i = -1;

function performProfiling() {
    // kill old recorders
    if(cpuRecorderProcess) {
        cpuRecorderProcess.kill();
    }
    if(memRecorderProcess) {
        memRecorderProcess.kill();
    }

    if(!prevTxBytes) {
        prevTxBytes = getTxBytes();
        prevRxBytes = getRxBytes();
    } else {
        const currTxBytes = getTxBytes();
        const currRxBytes = getRxBytes();

        const totalTxBytes = currTxBytes - prevTxBytes;
        const totalRxBytes = currRxBytes - prevRxBytes;
        const totalBytes = totalRxBytes + totalTxBytes;

        prevTxBytes = currTxBytes;
        prevRxBytes = currRxBytes;

        stream.write(`${i-1},${totalTxBytes},${totalRxBytes},${totalBytes}\n`);
    }

    console.log("killed old recorders");

    // check if we're done
    if(i >= packetForwarderIps.length) {
        clearTimeout(timer);

        // reset sensors
        if(virtualSensorOrchestrate) {
            terminateSensorStreams(packetForwarderIps);
        }

        console.log("we're done!");
        stream.end();
        return;
    }

    // start recording the cpu and memory usage
    const cpuLogFileName = `cpu-${i}-gateways.log`;
    const memLogFileName = `mem-${i}-gateways.log`;

    cpuRecorderProcess = getCpuRecorder(cpuLogFileName);
    memRecorderProcess = getMemoryRecorder(memLogFileName);

    console.log("started new recorders");
    if(virtualSensorOrchestrate) {
        if(i >= 0) {
            setupSensorStreamAtGateway(`g${i}`, packetForwarderIps[i]);
        }
    }

    i += 1;
}

performProfiling();
const timer = setInterval(() => {
    performProfiling();
}, recordTimeMillis);