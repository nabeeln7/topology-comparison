#!/bin/bash

#total        used        free      shared  buff/cache   available
while true
do
  ts=$(date +%s)
  fr=$(free -m | awk 'FNR == 2 {print}')
  echo "${ts}        ${fr}"
  sleep 1
done