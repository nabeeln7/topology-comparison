const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');
const argv = require('yargs').argv;
const appUtils = require('./app-utils');
const { getRxBytes, getTxBytes } = require('./nw-traffic-profiler');

function deploySeveralApps(gatewayIp, numberOfApps, appPath, sensorReqmtPath, actuatorReqmtPath) {
    if(numberOfApps === 0) {
        console.log("[app-deployer] no apps to deploy. done.");
        return;
    }
    const appPromises = [...Array(numberOfApps)].map(_ => {
        appUtils.deployApp(gatewayIp, appPath, sensorReqmtPath, actuatorReqmtPath)
    });

    Promise.all(appPromises).then(_ => {
        console.log(`[app-deployer] ${numberOfApps} apps deployed successfully!`);
    });
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

function initializeSensorStreams(packetForwarderIps) {
    // send request to all PFs to stop evaluation
    const data = {
        "start": true
    };

    packetForwarderIps.forEach(ip => {
        mqttController.publish(ip, 'orchestrator', JSON.stringify(data));
    });
}

function setupSensorStreams(packetForwarderIps, numDevices, streamingRateMillis, payloadSizeBytes) {
    // send request to all PFs to setup their devices
    packetForwarderIps.forEach(ip => {
        const deviceIdList = sensorMapping[ip];

        const data = {
            "startDeviceId": deviceIdList[0],
            "endDeviceId": deviceIdList[deviceIdList.length - 1],
            "streamingRateMillis": streamingRateMillis,
            "payloadSizeBytes": payloadSizeBytes,
        };
        mqttController.publish(ip, 'orchestrator', JSON.stringify(data));
    });
}

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

const virtualSensorOrchestrate = argv.virtualSensorOrchestrate === 'true';
const recordTimeMillis = argv.recordTimeSec * 1000;
let i = argv.numAppsStart;
const loopEnd = argv.numApps;
const loopStep = argv.numAppsStep;
const deviceDistributionMode = argv.deviceDistributionMode;
const selfIp = argv.selfIp;

if(!deviceDistributionMode) {
    console.log('deviceDistributionMode is mandatory');
    process.exit(1);
}

let numDevices, streamingRateMillis, payloadSizeBytes, packetForwarderIps = [], sensorMapping, actuatorMapping;
if(virtualSensorOrchestrate) {
    numDevices  = argv.numDevices;
    streamingRateMillis = argv.streamingRateSec * 1000;
    payloadSizeBytes = argv.payloadSizeKB * 1000;

    sensorMapping = fs.readJsonSync(argv.sensorMappingJson);
    actuatorMapping = fs.readJsonSync(argv.actuatorMappingJson);
    packetForwarderIps = Object.keys(sensorMapping);
}

function getSensorRequirement(executingGatewayIp, deviceDistributionMode) {
    switch (deviceDistributionMode) {
        case 'all':
            return Object.values(sensorMapping).reduce((acc, current) => acc.concat(current));
        case 'distributed':
            if(packetForwarderIps.length === 5) { //omc mode
                return [58,52,0,95,49,10,90,53,40,34,94,16,72,25,70,73,30,89,83,86,78,7,57,63,82,74,11,84,22,59,97,9,42,24,77,35,79,88,46,87,54,39,14,19,55,51,166,148,162,196,186,173,119,165,128,185,177,189,107,178,133,198,167,125,187,159,141,139,122,170,154,108,153,168,123,109,172,138,254,224,205,293,299,230,217,285,272,237,238,256,264,239,266,200,288,283,215,250,242,213,260,222,248,209,219,291,223,262,263,278,246,216,206,253,214,297,273,231,298,212,249,282,280,201,268,294,281,220,226,255,279,225,244,270,290,236,258,319,388,341,334,398,326,360,346,370,318,322,365,349,395,380,342,356,353,385,300,368,357,396,390,378,323,310,305,376,367,302,393,362,307,377,344,350,340,354,382,332,375,399,374,345,312,321,355,309,313,371,320,317,379,364,358,387,343,369,348,389,333,308,336,306,391,301,335,329,384,352,337,303,361,325,359,372,366,304,311,383,331,392,324,363,386,347,315,316,327,351,381,373,397,338,339,314,485,472,404,468,450,414,446,452,405,420,408,482,498,443,497,407,411,440,460,487,434,459,466,480,461,479,481,449,438,400,429,428,496,493,474,462,470];
            } else {
                return [58,52,0,95,49,10,90,53,40,34,94,16,72,25,70,73,30,89,83,86,78,7,57,63,82,74,11,84,22,59,97,9,42,24,77,35,79,88,46,87,54,39,14,19,55,51,166,148,162,196,186,173,119,165,128,185,177,189,107,178,133,198,167,125,187,159,141,139,122,170,154,108,153,168,123,109,172,138,254,224,205,293,299,230,217,285,272,237,238,256,264,239,266,200,288,283,215,250,242,213,260,222,248,209,219,291,223,262,263,278,246,216,206,253,214,297,273,231,298,212,249,282,280,201,268,294,281,220,226,255,279,225,244,270,290,236,258,319,388,341,334,398,326,360,346,370,318,322,365,349,395,380,342,356,353,385,300,368,357,396,390,378,323,310,305,376,367,302,393,362,307,377,344,350,340,354,382,332,375,399,374,345,312,321,355,309,313,371,320,317,379,364,358,387,343,369,348,389,333,308,336,306,391,301,335,329,384,352,337,303,361,325,359,372,366,304,311,383,331,392,324,363,386,347,315,316,327,351,381,373,397,338,339,314];
            }
        case 'colocated': // return all devices on the executing gw
            return sensorMapping[executingGatewayIp];
        case 'random':
            if(packetForwarderIps.length === 5) { //omc mode
                return [483,83,449,393,69,109,267,387,62,100,252,137,434,186,463,80,200,209,258,201,361,340,136,160,213,400,353,458,90,399,5,8,23,486,492,159,485,40,392,457,275,10,223,7,18,202,4,190,172,85,255,164,207,177,396,87,115,269,216,304,264,336,384,2,273,55,78,133,48,82,135,37,453,125,131,113,366,147,134,401,493,444,281,233,38,410,237,497,249,378,427,99,138,454,123,451,112,447,66,128];
            } else {
                return [388,190,288,139,337,249,142,367,2,125,191,43,85,273,131,387,12,299,352,0,279,378,164,141,283,105,118,83,135,354,72,241,370,124,140,397,111,144,240,207,218,372,333,80,179,308,356,320,373,3,30,254,113,32,294,377,301,74,154,364,395,71,286,271,153,82,18,182,98,21,202,25,200,56,252,165,226,204,51,70];
            }
    }
}

function getActuatorRequirement(executingGatewayIp, deviceDistributionMode) {
    switch (deviceDistributionMode) {
        case 'all':
            return Object.values(actuatorMapping).reduce((acc, current) => acc.concat(current));
        case 'distributed':
            if(packetForwarderIps.length === 5) { //omc mode
                return [2,3,4,5,10,11,12,13,20,21,22,23,30,31,32,33,40,41,42,43];
            } else {
                return [2,3,4,5,10,11,12,13,20,21,22,23,30,31,32,33];
            }
        case 'colocated': // return all devices on the executing gw
            return actuatorMapping[executingGatewayIp];
        case 'random':
            if(packetForwarderIps.length === 5) { //omc mode
                return [43,36,33,31,27,0,42,17,16,12,26,29,24,5,6,38,44,8,1,18];
            } else {
                return [16,14,37,12,34,15,18,8,19,24,23,36,4,29,3,17];
            }
    }
}

// get the device requirement for the app and write to files
const sensorIdList = getSensorRequirement(selfIp, deviceDistributionMode);
const sensorIdListStr = sensorIdList.join();
fs.writeFileSync('sensorMapping.txt', sensorIdListStr);

const actuatorIdList = getActuatorRequirement(selfIp, deviceDistributionMode);
const actuatorIdListStr = actuatorIdList.join();
fs.writeFileSync('actuatorMapping.txt', actuatorIdListStr);

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

        stream.write(`${i-loopStep},${totalTxBytes},${totalRxBytes},${totalBytes}\n`);
    }

    console.log("killed old recorders");

    // check if we're done
    if(i > loopEnd) {
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
    const cpuLogFileName = `cpu-${i}-apps.log`;
    const memLogFileName = `mem-${i}-apps.log`;

    cpuRecorderProcess = getCpuRecorder(cpuLogFileName);
    memRecorderProcess = getMemoryRecorder(memLogFileName);

    console.log("started new recorders");
    // setup devices only once
    if(virtualSensorOrchestrate && !finishedSensorStreamsSetup) {
        setupSensorStreams(packetForwarderIps, i, streamingRateMillis, payloadSizeBytes);
        finishedSensorStreamsSetup = true;
    }

    // deploy 10 apps at a time, unless it's the first time
    const numberOfAppsToDeploy = (i === 0) ? 0 : loopStep;

    deploySeveralApps("localhost",
        numberOfAppsToDeploy,
        "./app.js",
        "./sensorMapping.txt",
        "./actuatorMapping.txt");

    i += loopStep;
}

if(virtualSensorOrchestrate) {
    initializeSensorStreams(packetForwarderIps);
}

performProfiling();
const timer = setInterval(() => {
    performProfiling();
}, recordTimeMillis);