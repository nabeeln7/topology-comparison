#!/bin/bash
source ./common-stuff.sh
topology='d'

# D (topology6)
# --
# 192.168.1.182: G
# 192.168.1.192: G
# 192.168.1.122: G
# 192.168.1.119: G
# 192.168.1.215: G

# G:
# common
# 	node sensors-sim.js --recipientMqttBrokerIps localhost
# 	node gateway.js --topology d

# 192.168.1.182
# 	sleep 30 && node orchestrator-devices.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numGateways 5 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215

# rest
# 	sleep 30 && node orchestrator-devices.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numGateways 5
clean_up

gateways=( '192.168.1.182' '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )
for gw in "${gateways[@]}"
do
	exec_ssh_nohup_cmd $gw $scripts_dir "node sensors-sim.js --recipientMqttBrokerIps localhost"

	# start gateway
	exec_ssh_nohup_cmd $gw $scripts_dir "node gateway.js --topology $topology"
done

ag=( '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )
for gw in "${ag[@]}"
do	
	exec_ssh_nohup_cmd $gw $scripts_dir 'node orchestrator-devices.js --virtualSensorOrchestrate false --recordTimeMillis 300000 --numGateways 5'
done

exec_ssh_nohup_cmd '192.168.1.182' $scripts_dir 'node orchestrator-devices.js --virtualSensorOrchestrate true --recordTimeMillis 300000 --numGateways 5 --forwarderIps 192.168.1.182,192.168.1.192,192.168.1.122,192.168.1.119,192.168.1.215'

sleep 1920 # wait for 32minutes

download_data $topology "${gateways[@]}"

