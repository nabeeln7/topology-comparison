const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer  = require('multer');
const MqttController = require("./mqtt-controller");
const mqttController = MqttController.getInstance();
const fs = require('fs-extra');
const { fork } = require('child_process');
const path = require('path');
const argv = require('yargs').argv;
const resourceUtils = require('./resource-utils');
const appUtils = require('./app-utils');

class DataPublishTarget {
    constructor(gatewayIp, topic, sensorIds) {
        this.gatewayIp = gatewayIp;
        this.topic = topic;
        this.sensorIds = sensorIds;
    }
}

/**
 * This function returns a multer object after setting up the directory used to store the uploaded files. The function
 * also sets the relevant fields for the multer upload package used for multipart form-data.
 * @returns {multer|undefined}
 */
function getMultipartFormDataUploader() {
    //store the uploaded files to deployed-apps directory. Create this directory if not already present.
    const multerStorage = multer.diskStorage({
        //set the storage destination
        destination: function (req, file, cb) {
            cb(null, deployedAppsPath);
        },
        //use the original filename as the multer filename
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    });
    return multer({ storage: multerStorage });
}

const topology = argv.topology;
if(!topology) {
    console.log('topology mandatory');
    process.exit(1);
}

let gatewayType = "";
if(topology === 'cwa' || topology === 'cwda') {
    gatewayType = argv.gatewayType; // G or AG
    if(!gatewayType) {
        console.log('gatewayType mandatory for cwa, cwda');
        process.exit(1);
    }
}

let actuatorMapping = {};
let sensorMapping = {};
// if(!argv.actuatorMappingJson) {
//     console.log('actuatorMappingJson not specified.');
// }
if(!argv.sensorMappingJson) {
    console.log('sensorMappingJson not specified.');
} else {
    // actuatorMapping = fs.readJsonSync(argv.actuatorMappingJson);
    sensorMapping = fs.readJsonSync(argv.sensorMappingJson);
}

const app = express();
const port = process.env.PORT || 7000;

const subscribedGws = [resourceUtils.getIp()];
const dataPublishTargets = [];

fs.ensureDirSync(path.join(__dirname, 'data'));
fs.emptyDirSync(path.join(__dirname, 'data')); // clear directory

// Create logs directory for apps if not present
fs.ensureDirSync(path.join(__dirname, 'logs'));
fs.emptyDirSync(path.join(__dirname, 'logs')); // clear directory

const deployedAppsPath = path.join(__dirname, 'deployed-apps');
fs.ensureDirSync(deployedAppsPath);
fs.emptyDirSync(deployedAppsPath); // clear directory

//TODO check why this is needed
app.use(cors({credentials: true, origin: true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.listen(port, function() {
    console.log(`API server started on port ${port}`)
});

const uploader = getMultipartFormDataUploader();

// app.post('/execute-app', uploader.fields([{name: 'app'}, {name: 'sensorReqmt'}, {name: 'actuatorReqmt'}]), executeApp);
app.post('/execute-app', uploader.fields([{name: 'app'}, {name: 'sensorReqmt'}]), executeApp);
app.post('/deploy-app', uploader.fields([{name: 'app'}, {name: 'sensorReqmt'}]), deployApp); // deploy app to ideal gw
app.post('/add-data-publish-target', addDataPublishTarget);
app.get('/resource-usage',getResourceUsage);
async function getResourceUsage(req, res) {
    const resourceUsage = await resourceUtils.getResourceUsage();
    return res.json(resourceUsage);
}

async function addDataPublishTarget(req, res) {
    const data = req.body;
    const targetGatewayIp = data.targetGatewayIp;
    const sensorIds = data.sensorIds;
    const topic = data.topic;

    const newDataTarget = new DataPublishTarget(targetGatewayIp, topic, sensorIds);
    dataPublishTargets.push(newDataTarget);

    console.log(`received a new data publish target. all set for ${targetGatewayIp}, ${topic}. `);
}

// will get here if it is cwa, cwda, or d
async function deployApp(req, res) {
    const appPath = req["files"]["app"][0]["path"];
    const sensorReqmtPath = req["files"]["sensorReqmt"][0]["path"];
    // const actuatorReqmtPath = req["files"]["actuatorReqmt"][0]["path"];
    const appId = req.body.appId;

    let sensorReqmt = fs.readFileSync(sensorReqmtPath, 'utf8').split(',');

    // figure out the best gateway to execute the app
    const targetGateway = await resourceUtils.getIdealGateway(sensorReqmt, sensorMapping);
    // send the app to be executed
    if(targetGateway != null) {
        await appUtils.executeApp(targetGateway.ip, appId, appPath, sensorReqmtPath);
        console.log(`app ${appId} deployed on ${targetGateway.ip}`);

        if(topology === 'cwa') {
            // setup the sensor streams for this app
            // create a new data publish target at this gateway, to forward data to the app's topic
            const newTarget = new DataPublishTarget(targetGateway.ip, appId, sensorReqmt);
            dataPublishTargets.push(newTarget);
            console.log(`added new data publish target for ${appId}`);
        } else if(topology === 'cwda' || topology === 'd') {
            // figure out which gateways have the sensors required by the app
            const gwSensorMapping = resourceUtils.getHostGateways(sensorReqmt, sensorMapping);

            // now request each of those gateways to forward data to the targetGateway @ appId topic
            Object.keys(gwSensorMapping).forEach(hostGatewayIp => {
                const dataPublishTargetData = {
                    targetGatewayIp: targetGateway.ip,
                    sensorIds: sensorReqmt,
                    topic: appId
                };
                appUtils.requestToAddDataPublishTarget(hostGatewayIp, dataPublishTargetData);
                console.log(`requested ${hostGatewayIp} to create new data publish target 
                    [targetGateway: ${targetGateway.ip}, topic: ${appId}]`);
            });
        }
    }
    res.send();
}

async function executeApp(req, res) {
    const appPath = req["files"]["app"][0]["path"];
    const sensorReqmtPath = req["files"]["sensorReqmt"][0]["path"];
    // const actuatorReqmtPath = req["files"]["actuatorReqmt"][0]["path"];
    const appId = req.body.appId;

    let sensorReqmt = fs.readFileSync(sensorReqmtPath, 'utf8').split(',');
    // let actuatorReqmt = fs.readFileSync(actuatorReqmtPath, 'utf8').split(',');

    if(topology === 'c' || topology === 'omc') {
        const newDataTarget = new DataPublishTarget('localhost', appId, sensorReqmt);
        dataPublishTargets.push(newDataTarget);
    }

    forkApp(appId, appPath);
    res.send();
}


//throw an error if it is an unknown endpoint
app.use(function(req, res) {
    res.status(404).send(`${req.originalUrl} is not a valid endpoint.`);
});

// metadata -> deviceids
function forkApp(appId, appPath) {
    const appLogPath = path.join(__dirname, 'logs', `${appId}.out`);
    const newApp = fork(appPath, [], {
        env: { TOPIC: appId },
        stdio: [
            0,
            fs.openSync(appLogPath, 'w'),
            fs.openSync(appLogPath, 'a'),
            "ipc"
        ]
    });
    console.log(`Deployed ${appId} at ${appPath}`);
}

// listen to topo-data for any new data if you're not an AG in CWA
if(topology !== 'cwa' || gatewayType !== 'ag') {
    mqttController.subscribeToPlatformMqtt(handleMqttMessage);
    console.log("listening to topo-data for data streams");
}

function handleMqttMessage(message) {
    dataPublishTargets.forEach(dataPublishTarget => {
        const data = JSON.parse(message);
        const deviceId = data['id'];

        if(dataPublishTarget.sensorIds.includes(deviceId)) {
            mqttController.publish(dataPublishTarget.gatewayIp,
                dataPublishTarget.topic,
                message);
        }
    });
}

// mqttController.subscribe('localhost', 'actuator-requests', message => {
//     const data = JSON.parse(message);
//     const actuatorId = parseInt(data['id']);
//
//     Object.entries(actuatorMapping).forEach(entry => {
//         const [gatewayIp, actuatorIdList] = entry;
//         if(actuatorIdList.includes(actuatorId)) {
//             mqttController.publish(gatewayIp, 'act-msgs', message);
//         }
//     });
// });