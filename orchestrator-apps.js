const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');
const argv = require('yargs').argv;
const appUtils = require('./app-utils');
const resourceUtils = require('./resource-utils');
const { getRxBytes, getTxBytes } = require('./nw-traffic-profiler');

function deployApp(appId) {
    // read the app requirements file
    // get the app file
    // decide where to deploy it!
    // deploy app

    const appReqDir = './sensor-mapping/app-reqmts';
    const appsDir = './apps';
    const appReqPath = `${appReqDir}/a${appId}.txt`;
    const appPath = `${appsDir}/app${appId}.js`;

    if(topology === 'c') {
        const gatewayIp = 'localhost';
        appUtils.deployApp(gatewayIp, appPath, appReqPath)
            .then(resolved => console.log(`[app-deployer] app ${appId} deployed on ${gatewayIp}`));
    } else if(topology === 'omc') {
        const gatewayIps = Object.keys(sensorMapping).slice(0,2); // get first two gateways
        const gatewayId = appId % 2;
        const gatewayIp = gatewayIps[gatewayId];

        appUtils.deployApp(gatewayIp, appPath, appReqPath)
            .then(resolved => console.log(`[app-deployer] app ${appId} deployed on ${gatewayIp}`));
    } else {
        const appReqText = fs.readFileSync(appReqPath).toString();
        const sensorIdList = appReqText.split(',');
        resourceUtils.getIdealGateway(sensorIdList, sensorMapping).then(gateway => {
                if(gateway !== null) {
                    appUtils.deployApp(gateway.ip, appPath, appReqPath)
                        .then(resolved => console.log(`app ${appId} deployed on ${gateway.ip}`));
                }
            })
    }
}

function deploySeveralApps(numberOfApps, appPath, sensorReqmtPath, actuatorReqmtPath) {
    if(numberOfApps === 0) {
        console.log("[app-deployer] no apps to deploy. done.");
        return;
    }

    if(topology === 'c' || topology === 'omc') {
        const gatewayIp = 'localhost';
        const appPromises = [...Array(numberOfApps)].map(_ => {
            appUtils.deployApp(gatewayIp, appPath, sensorReqmtPath, actuatorReqmtPath);
        });

        Promise.all(appPromises).then(_ => {
            console.log(`[app-deployer] ${numberOfApps} apps deployed successfully!`);
        });
    } else {
        for(let i=0; i<numberOfApps; i++) {
            resourceUtils.getIdealGateway(sensorIdList, sensorMapping).then(gateway => {
                if(gateway !== null) {
                    appUtils.deployApp(gateway.ip, appPath, sensorReqmtPath, actuatorReqmtPath)
                        .then(_ => console.log(`app ${i + 1} out of ${numberOfApps} deployed on ${gateway.ip}`));
                }
            })
        }
    }
}

function getCpuRecorder(logFileName) {
    const process = spawn('sar', ['-u', '1']);
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

function terminateActuatorDevices(packetForwarderIps) {
    // send request to all PFs to stop evaluation
    const data = {
        "stop": true
    };

    packetForwarderIps.forEach(ip => {
        mqttController.publish(ip, 'act-msgs', JSON.stringify(data));
    });
}

function setupSensorStreams() {
    // send request to all PFs to setup their devices
    packetForwarderIps.forEach(ip => {
        const deviceIdList = sensorMapping[ip];

        const data = {
            "start": "true",
            "deviceIds": deviceIdList
        };
        mqttController.publish(ip, 'orchestrator', JSON.stringify(data));
    });
}

// for i = 0 to 100, step by 10
//      start cpu and memory recording to output files cpu-{i}-devices, mem-{i}-devices
//      add 5 devices
//      wait for 5 minutes

const virtualSensorOrchestrate = argv.virtualSensorOrchestrate === 'true';
const recordTimeMillis = argv.recordTimeMillis;
const numApps = argv.numApps;
const topology = argv.topology;
const sensorMapping = fs.readJsonSync(argv.sensorMappingJson); // colocated.json, distributed.json,..
// const actuatorMapping = fs.readJsonSync(argv.actuatorMappingJson);

let packetForwarderIps = [];
if(virtualSensorOrchestrate) {
    packetForwarderIps = Object.keys(sensorMapping);
}

const selfIp = resourceUtils.getIp();

let cpuRecorderProcess;
let memRecorderProcess;

fs.ensureDirSync(path.join(__dirname, 'data'));
fs.emptyDirSync(path.join(__dirname, 'data'));
const nwTrafficLogFileName = 'nw-traffic.csv'; // 0,1000 1,2000,.....
const stream = fs.createWriteStream(path.join(__dirname, 'data', nwTrafficLogFileName), {flags:'w'});
stream.write(`# record time (ms) = ${recordTimeMillis}\n`);
stream.write(`# numDevices,totalTxBytes,totalRxBytes,totalBytes\n`);
let prevTxBytes;
let prevRxBytes;

let finishedSensorStreamsSetup = false;

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

        stream.write(`${i},${totalTxBytes},${totalRxBytes},${totalBytes}\n`);
    }

    console.log("killed old recorders");

    // check if we're done
    if(i > numApps - 1) {
        clearTimeout(timer);

        // reset sensors
        if(virtualSensorOrchestrate) {
            terminateSensorStreams(packetForwarderIps);
        }

        console.log("we're done!");
        stream.end();

        setTimeout(() => {
            process.exit(0);
        }, 5000);

        return;
    }

    // start recording the cpu and memory usage
    const cpuLogFileName = `cpu-${i+1}-apps.log`;
    const memLogFileName = `mem-${i+1}-apps.log`;

    cpuRecorderProcess = getCpuRecorder(cpuLogFileName);
    memRecorderProcess = getMemoryRecorder(memLogFileName);

    console.log("started new recorders");
    // setup devices only once
    if(virtualSensorOrchestrate) {
        if(!finishedSensorStreamsSetup) {
            setupSensorStreams();
            finishedSensorStreamsSetup = true;    
        }

        if(i !== -1) {
            deployApp(i);
        }
    }
    // // deploy 10 apps at a time, unless it's the first time
    // const numberOfAppsToDeploy = (i === 0) ? 0 : loopStep;

    // deploySeveralApps(numberOfAppsToDeploy,
    //     "./app.js",
    //     "./sensorMapping.txt",
    //     "./actuatorMapping.txt");
    
    i += 1;
}

performProfiling();
const timer = setInterval(() => {
    performProfiling();
}, recordTimeMillis);