#!/bin/bash
source ./common-stuff.sh
sensorMappingJson=$1
deviceDistMode=$2
topology='cwa'

# test3
# CWA (topology4)
# --
# 192.168.1.182: G
# 192.168.1.192: AG
# 192.168.1.122: AG
# 192.168.1.119: AG
# 192.168.1.215: AG

# G, AG
# common
# 	node gateway.js --topology cwa

# G:
# sleep 30 && node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215

# node sensors-sim-apps-study.js --recipientMqttBrokerIps localhost

# AG:
# node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182

# sleep 30 && node orchestrator-apps.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numApps 5
clean_up

gateways=( '192.168.1.182' '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )

ag=( '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )
for gw in "${ag[@]}"
do	
	# start gateway
	exec_ssh_nohup_cmd $gw $scripts_dir "node gateway.js --topology $topology --gatewayType ag --sensorMappingJson $sensorMappingJson"

	exec_ssh_nohup_cmd $gw $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps 192.168.1.182'

	exec_ssh_nohup_cmd $gw $scripts_dir "node orchestrator-apps.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numApps 5 --topology $topology --sensorMappingJson $sensorMappingJson"
done

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir "node gateway.js --topology $topology --gatewayType g --sensorMappingJson $sensorMappingJson"

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir 'node sensors-sim-apps-study.js --recipientMqttBrokerIps localhost'

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir "node orchestrator-apps.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numApps 5 --topology $topology --sensorMappingJson $sensorMappingJson"

sleep 1920 # wait for 32minutes

download_data $deviceDistMode $topology "${gateways[@]}"

