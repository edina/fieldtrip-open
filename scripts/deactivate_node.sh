#!/bin/bash

# Removea a prepended node bin path from the path

NODE_PATH=$(pwd)/node_modules
NODE_BIN=$NODE_PATH/.bin

export PATH=$(echo $PATH | sed -e "s;\(^${NODE_BIN}:\);;g")