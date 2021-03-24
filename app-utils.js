const request = require('request-promise');
const fs = require('fs-extra');

function transferFiles(uri, files, textFields) {
    const formData = {};

    // first copy all key-vals from textFields to formData
    Object.assign(formData, textFields);

    // add file streams to fields
    Object.keys(files).forEach(fileName => {
        const filePath = files[fileName];
        formData[fileName] = fs.createReadStream(filePath);
    });

    const options = {
        method: 'POST',
        uri: uri,
        formData: formData
    };

    return request(options);
}

exports.deployAppForResolution = function(gatewayIp, appId, appPath, sensorReqmtPath) {
    const appFiles = {
        app: appPath,
        sensorReqmt: sensorReqmtPath
    };

    const httpFileTransferUri = `http://${gatewayIp}:7000/deploy-app`;
    return transferFiles(httpFileTransferUri, appFiles, {
        appId: appId
    });
};

exports.executeApp = function(gatewayIp, appId, appPath, sensorReqmtPath) {
    const appFiles = {
        app: appPath,
        sensorReqmt: sensorReqmtPath
    };

    const httpFileTransferUri = `http://${gatewayIp}:7000/execute-app`;
    return transferFiles(httpFileTransferUri, appFiles, {
        appId: appId
    });
};

exports.sendImage = function(gatewayIp, imagePath) {
    const files = {
        file: imagePath
    };

    const httpFileTransferUri = `http://${gatewayIp}:8000/predict/image`;
    return transferFiles(httpFileTransferUri, files, {});
};

exports.getResourceUsage = async function(gatewayIp) {
    const execUrl = `http://${gatewayIp}:7000/resource-usage`;
    const body = await request({method: 'GET', uri: execUrl});
    return JSON.parse(body);
};