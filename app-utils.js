const request = require('request-promise');
const fs = require('fs-extra');

function transferFiles(uri, files) {
    const readStreamObjects = {};
    for (const formField in files) {
        const filePath = files[formField];
        readStreamObjects[formField] = fs.createReadStream(filePath);
    }

    const options = {
        method: 'POST',
        uri: uri,
        formData: readStreamObjects
    };

    return request(options);
}

exports.deployApp = function(gatewayIp, appPath, sensorReqmtPath, actuatorReqmtPath) {
    const appFiles = {
        app: appPath,
        sensorReqmt: sensorReqmtPath,
        actuatorReqmt: actuatorReqmtPath
    };

    const httpFileTransferUri = `http://${gatewayIp}:7000/execute-app`;
    return transferFiles(httpFileTransferUri, appFiles);
};

