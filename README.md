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

2. nodejs/npm
If you want to install it globally then follow the instructions here:
http://nodejs.org/dist/v0.10.24/node-v0.10.24.tar.gz
If you want to install it locally then you can follow these instructions:
http://tnovelli.net/blog/blog.2011-08-27.node-npm-user-install.html

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
fab release_android
```

License
----

BSD


**Free Software, Hell Yeah!**

[Installation guide]:http://developer.android.com/sdk/installing/index.html
