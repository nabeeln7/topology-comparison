#!/bin/bash
scripts_dir="/root/topology-comparison"
local_dir="/Users/nabeelnasir/phd/research/evaluation/topology-comparison/mobicom21/data/devices"
all_gateways=( '192.168.1.182' '192.168.1.192' '192.168.1.122' '192.168.1.119' '192.168.1.215' )

exec_ssh_nohup_cmd(){
	ip=$1
	cwd=$2
	cmd=$3

	ssh root@$ip "cd $cwd; nohup $cmd 1>/dev/null 2>/dev/null &"
	echo "[$ip] executed $cmd"
}

download_data(){
	# https://askubuntu.com/a/995110
	directory_name=$1 	# Save first argument in a variable
	shift 				# Shift all arguments to the left (original $1 gets lost)
	source_ips=("$@") 	# Rebuild the array with rest of arguments
	

	mkdir "$local_dir/$directory_name"
	for ip in "${source_ips[@]}"
	do
		echo "[$ip] downloading data..."
		mkdir "$local_dir/$directory_name/$ip"
		scp root@$ip:/root/topology-comparison/data/* "$local_dir/$directory_name/$ip"
	done
}

clean_up(){
	for ip in "${all_gateways[@]}"
	do
		# kill gateway.js
		exec_ssh_nohup_cmd $ip $scripts_dir 'pkill -f gateway.js'

		# kill sensors-sim.js
		exec_ssh_nohup_cmd $ip $scripts_dir 'pkill -f sensors-sim.js'

		# kill orchestrator-devices.js
		exec_ssh_nohup_cmd $ip $scripts_dir 'pkill -f orchestrator-devices.js'
	done
}