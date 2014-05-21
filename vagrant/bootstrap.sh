#!/usr/bin/env bash

apt-get update
apt-get -y install ant python-setuptools python2.7-dev git
easy_install pip
pip install fabric jinja2 beautifulsoup4 html5lib
