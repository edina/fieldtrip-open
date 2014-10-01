#!/bin/bash

# Prepend the node bin path to the path

NODE_PATH=$(pwd)/node_modules
NODE_BIN=$(pwd)/node_modules/.bin

if [ -d $NODE_PATH ]; then
    export PATH=$NODE_BIN:$PATH
    echo "$NODE_BIN was prepended to your PATH"
else
    echo "Not $NODE_PATH found"
fi
