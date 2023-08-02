# !usr/bin/env bash
SOURCE=$(pwd)

for f in ./contracts/*
do
  echo "generating schema for ${f##*/}"
  cd $f
  echo $(pwd)
  cargo schema
  rm -rf schema/raw
  eval $CMD &> /dev/null
  cd $SOURCE
done  
