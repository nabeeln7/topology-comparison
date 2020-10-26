const osUtils = require('os-utils');
const appUtils = require('./app-utils');

function getFreeCpuPercent() {
    return new Promise(resolve => {
        osUtils.cpuFree(cpuFreePercent => {
            resolve(cpuFreePercent)
        });
    })
}

function getFreeMemoryMB() {
    return osUtils.freemem();
}

/**
 * Get the % of free cpu, and the megabytes of free memory available
 * @return {Promise<{cpu: *, memory: *}>}
 */
function getResourceUsage() {
    return getFreeCpuPercent().then(freeCpuPercent => {
        return {
            cpuFreePercent: freeCpuPercent,
            memoryFreeMB: getFreeMemoryMB()
        };
    })
}

class Gateway {
    constructor(ip, memoryFreeMB, cpuFreePercent, numDevicesSupported) {
        this.ip = ip;
        this.memoryFreeMB = memoryFreeMB;
        this.cpuFreePercent = cpuFreePercent;
        this.numDevicesSupported = numDevicesSupported;
    }

    toString() {
        return `Gateway @ ${this.ip}, [MemFreeMB: ${this.memoryFreeMB}, CPUFreePercent: ${this.cpuFreePercent}, 
            numDevicesSupported: ${this.numDevicesSupported}]`;
    }
}

// Specifies the threshold free CPU % and available memory on the gateways to execute an application
const CPU_FREE_PERCENT_THRESHOLD = 0.05; // 5% free CPU
const MEM_FREE_MB_THRESHOLD = 200; // 200MB of available memory

async function getHostGateways(devicesIds, sensorMapping) {
    const gatewayToSensorMapping = {};

    for (const [gatewayIp, gatewayDeviceList] of Object.entries(sensorMapping)) {
        //for each device given to us, find out if that is present in the device list of the current gw
        for (let i = 0; i < devicesIds.length; i++) {
            const targetDeviceId = devicesIds[i];

            if (gatewayDeviceList.includes(targetDeviceId)) {
                if (gatewayIp in gatewayToSensorMapping) {
                    gatewayToSensorMapping[gatewayIp].push(targetDeviceId);
                } else {
                    gatewayToSensorMapping[gatewayIp] = [targetDeviceId];
                }
            }
        }
    }
    return gatewayToSensorMapping;
}

function compareGateways(gateway1, gateway2) {
    if(gateway1.numDevicesSupported === gateway2.numDevicesSupported) {
        if(gateway1.memoryFreeMB === gateway2.memoryFreeMB) {
            return gateway1.cpuFreePercent >= gateway2.cpuFreePercent ? gateway1 : gateway2;
        } else {
            return gateway1.memoryFreeMB > gateway2.memoryFreeMB ? gateway1 : gateway2;
        }
    } else {
        return gateway1.numDevicesSupported > gateway2.numDevicesSupported ? gateway1 : gateway2;
    }
}

async function getIdealGateway(sensorIdList, sensorMapping) {

    // for each gateway in the link graph, obtain the resource usage
    const gatewayIpAddresses = Object.keys(sensorMapping);

    const promises = gatewayIpAddresses.map(ip => appUtils.getResourceUsage(ip));
    const resourceUsages = await Promise.all(promises);

    const gatewayToDeviceMapping = await getHostGateways(sensorIdList, sensorMapping);

    const availableGateways = [];
    gatewayIpAddresses.forEach((gatewayIp, index) => {
        const gateway = new Gateway(gatewayIp,
            resourceUsages[index]['memoryFreeMB'],
            resourceUsages[index]['cpuFreePercent'],
            gatewayToDeviceMapping.hasOwnProperty(gatewayIp) ?
                gatewayToDeviceMapping[gatewayIp].length : 0);

        availableGateways.push(gateway);
    });

    // filter out gateways which do not have enough resources to run the application
    const candidateGateways = availableGateways.filter(gateway => gateway.cpuFreePercent >= CPU_FREE_PERCENT_THRESHOLD &&
        gateway.memoryFreeMB >= MEM_FREE_MB_THRESHOLD);

    if(candidateGateways.length === 0) {
        console.log('Gateway devices are low on resources. Could not deploy application.');
        return null;
    } else {
        // find the best gateway by comparing amongst each other
        return candidateGateways.reduce(compareGateways);
    }
}

module.exports = {
    getResourceUsage: getResourceUsage,
    getIdealGateway: getIdealGateway
};