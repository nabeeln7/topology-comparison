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

let actuatorMapping = {};
if(!argv.actuatorMappingJson) {
    console.log('actuatorMappingJson not specified.');
} else {
    actuatorMapping = fs.readJsonSync(argv.actuatorMappingJson);
}

const app = express();
const port = process.env.PORT || 7000;

const appSensorMapping = {};
let appCount = 0;

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

app.post('/execute-app', uploader.fields([{name: 'app'}, {name: 'sensorReqmt'}, {name: 'actuatorReqmt'}]), executeApp);
app.get('/resource-usage',getResourceUsage);
async function getResourceUsage(req, res) {
    const resourceUsage = await resourceUtils.getResourceUsage();
    return res.json(resourceUsage);
}

async function executeApp(req, res) {
    const appPath = req["files"]["app"][0]["path"];
    const sensorReqmtPath = req["files"]["sensorReqmt"][0]["path"];
    const actuatorReqmtPath = req["files"]["actuatorReqmt"][0]["path"];

    let sensorReqmt = fs.readFileSync(sensorReqmtPath, 'utf8').split(',');
    let actuatorReqmt = fs.readFileSync(actuatorReqmtPath, 'utf8').split(',');
    const appId = `app${appCount}`;

    appSensorMapping[appId] = sensorReqmt;
    forkApp(appId, appPath);
    appCount += 1;

    // pass on actuator reqmt to the app
    setTimeout(() => {
        const data = {
            "setup": "yes",
            "actuatorIds": actuatorReqmt
        };
        mqttController.publish('localhost', appId, JSON.stringify(data));
    }, 5000);

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
        env: { TOPIC: appId }
    });
    console.log(`Deployed ${appId} at ${appPath}`);
    console.log(`Logs: ${appLogPath}`);
}

// listen to topo-data for any new data
mqttController.subscribeToPlatformMqtt(message => {
    const data = JSON.parse(message);
    const deviceId = data['id'];

    Object.entries(appSensorMapping).forEach(entry => {
        const [appId, sensorIdList] = entry;
        if(sensorIdList.includes(deviceId)) {
            mqttController.publish('localhost', appId, message);
        }
    });
});

mqttController.subscribe('localhost', 'actuator-requests', message => {
    const data = JSON.parse(message);
    const actuatorId = parseInt(data['id']);

    Object.entries(actuatorMapping).forEach(entry => {
        const [gatewayIp, actuatorIdList] = entry;
        if(actuatorIdList.includes(actuatorId)) {
            mqttController.publish(gatewayIp, 'act-msgs', message);
        }
    });
});