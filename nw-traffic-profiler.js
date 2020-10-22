const { execSync } = require('child_process');

function getRxBytes() {
    const result = execSync('cat /sys/class/net/wlan0/statistics/rx_bytes');
    return parseInt(result.toString());
}

function getTxBytes() {
    const result = execSync('cat /sys/class/net/wlan0/statistics/tx_bytes');
    return parseInt(result.toString());
}

module.exports = {
    getTxBytes: getTxBytes,
    getRxBytes: getRxBytes
};