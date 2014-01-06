Fieldtrip-Open
==============

Fieldtrip-Open is a mobile mapping and data collection app.

# Software Requirements

  - Fabric
  - nodejs
  - android

### Installation Instructions of required software

1. Fabric:
```
apt-get install python-setuptools  # for easy_install
easy_install pip
pip install fabric
```

2. nodejs
 - Add this to your ~/.npmrc (create the file if it doesn't exist already):
```
root =    /home/YOUR-USERNAME/.local/lib/node_modules
binroot = /home/YOUR-USERNAME/.local/bin
manroot = /home/YOUR-USERNAME/.local/share/man
```
 
  - Download the Nodejs source code from nodejs.org and install it under your ~/.local tree and install it like this:
```
tar xf node......
cd node........
./configure --prefix=~/.local
make
make install
```

  - Create ~/.node_modules symlink.
```
cd
ln -s .local/lib/node_modules .node_modules
```

  - Check if npm is installed and where
```
which npm
```

  - If it says ~/.local/bin/npm, you're done. Otherwise, do this...
```
export PATH=$HOME/.local/bin:$PATH
```
...and add that line to your ~/.profile file, so it'll run every time you log in.

3. Android

[Installation guide]

### Installation instructions of app

1. Prepare a configuration file
Go and check the template for this which is inside etc/config.tmpl. Create a config.ini out of it and save it in the same path.

2. Go to the home path of you cloned project and run:
```
fab -l
```
A series of functions will be listed.

3. For preparing your android development
```
fab install_project
```

4. For deploying to your android phone:
```
fab deploy_android
```

5. For releasing it to play store:
```
fab fab release_android
```

License
----

BSD


**Free Software, Hell Yeah!**

[Installation guide]:http://developer.android.com/sdk/installing/index.html