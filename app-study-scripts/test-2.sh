#!/bin/bash
source ./common-stuff.sh
sensorMappingJson=$1
topology='omc'
# test2

# 192.168.1.182: G
# 192.168.1.192: G
# 192.168.1.122: PF
# 192.168.1.119: PF
# 192.168.1.215: PF

# G:
# common
# 	node sensors-sim-apps-study.js --recipientMqttBrokerIps localhost
# 	node gateway.js --topology omc

# 192.168.1.182
# 	sleep 30 && node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215

# 192.168.1.192
# 	sleep 30 && node orchestrator-apps.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numApps 5

# PF: 
# node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182,192.168.1.192
clean_up

gateways=( '192.168.1.182' '192.168.1.192' )
for gw in "${gateways[@]}"
do
	# send to each other as well
	exec_ssh_nohup_cmd $gw $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182,192.168.1.192'
	
	# start gateway
	exec_ssh_nohup_cmd $gw $scripts_dir "node gateway.js --topology $topology --sensorMappingJson $sensorMappingJson"
done

others=( '192.168.1.122' '192.168.1.119' '192.168.1.215' )
for gw in "${others[@]}"
do	
	exec_ssh_nohup_cmd $gw $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182,192.168.1.192'
done

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir "node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --topology $topology --sensorMappingJson $sensorMappingJson"

exec_ssh_nohup_cmd '192.168.1.192' $scripts_dir "node orchestrator-apps.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numApps 5 --topology $topology --sensorMappingJson $sensorMappingJson"

sleep 1920 # wait for 32minutes

download_data $topology "${gateways[@]}"

