#!/usr/bin/env bash

# install fieldtrip dependencies
apt-get update
apt-get -y install ant bash build-essential emacs23 git make openjdk-7-jdk python-setuptools python2.7-dev unzip vim
easy_install pip
pip install fabric jinja2 beautifulsoup4 html5lib

# install nodejs
sudo -u vagrant mkdir /home/vagrant/local
cd /home/vagrant/local
sudo -u vagrant wget http://nodejs.org/dist/v0.10.28/node-v0.10.28.tar.gz
sudo -u vagrant tar xvfz node-v0.10.28.tar.gz
cd node-v0.10.28
sudo -u vagrant ./configure --prefix=/home/vagrant/local && sudo -u vagrant make && sudo -u vagrant make install

# install android
cd /home/vagrant/local
sudo -u vagrant wget http://dl.google.com/android/android-sdk_r22.6.2-linux.tgz
sudo -u vagrant tar xvfz android-sdk_r22.6.2-linux.tgz

# update path
echo "export PATH=/home/vagrant/local/bin:/home/vagrant/local/android-sdk-linux/tools:/home/vagrant/locol/android/platform-tools:$PATH" >> /home/vagrant/.bashrc
echo "export JAVA_HOME=/usr/lib/jvm/java-1.7.0-openjdk-i386" >> /home/vagrant/.bashrc

# fab complete

# android rules