#!/bin/bash
source ./common-stuff.sh
sensorMappingJson=$1
deviceDistMode=$2
topology='c'

# run test 1
# 192.168.1.182: G
# 192.168.1.192: PF
# 192.168.1.122: PF
# 192.168.1.119: PF
# 192.168.1.215: PF

# G:
# sleep 30 && node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215

# node sensors-sim-apps-study.js --recipientMqttBrokerIps localhost

# node gateway.js --topology c

# PF:
# node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182
clean_up

gateways=( '192.168.1.182' )
for gw in "${gateways[@]}"
do
	exec_ssh_nohup_cmd $gw $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps localhost'
	
	# start gateway
	exec_ssh_nohup_cmd $gw $scripts_dir "node gateway.js --topology $topology --sensorMappingJson $sensorMappingJson"
done

others=( '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )
for gw in "${others[@]}"
do	
	exec_ssh_nohup_cmd $gw $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182'
done

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir "node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --topology $topology --sensorMappingJson $sensorMappingJson"

sleep 1920 # wait for 32minutes

download_data $deviceDistMode $topology "${gateways[@]}"

# ssh root@192.168.1.182 'cd /root/topology-comparison; nohup node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.182 'cd /root/topology-comparison; nohup node gateway.js --topology c 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.192 'cd /root/topology-comparison; nohup node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.122 'cd /root/topology-comparison; nohup node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.119 'cd /root/topology-comparison; nohup node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.215 'cd /root/topology-comparison; nohup node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182 1>/dev/null 2>/dev/null &'

# ssh root@192.168.1.182 'cd /root/topology-comparison; nohup node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215 1>/dev/null 2>/dev/null &'

