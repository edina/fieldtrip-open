# Dependencies

### Python and NodeJS

Use your favorite package manager to install:

- [Python 2.7](https://www.python.org/download/releases/2.7)
- [Pip](https://pypi.python.org/pypi/pip)
- [Apache Ant](http://ant.apache.org/) (for android only)
- [wget](https://www.gnu.org/software/wget/) (OSX)

#### Linux

##### Ubuntu / Debian
```
sudo apt-get install python-setuptools python2.7-dev nodejs ant
```

#### OSX
Add OSX and iOS sections to the dependencies doc

##### Macports

```
sudo port install apache-ant python27 py27-pip nodejs wget
```

##### Brew
Add OSX and iOS sections to the dependencies doc
```
brew install ant python node wget
```

### Nodejs (preferably installed locally)

[nodejs install](https://github.com/joyent/node/wiki/installation)

### Fabric

Install some libraries used for the deploy:

```
sudo pip install beautifulsoup4 configparser fabric html5lib jinja2

```

## Target Platforms

### Android
Add OSX and iOS sections to the dependencies doc

[Android install](http://developer.android.com/sdk/index.html)

Ensure the sdk tools and platforms-tools directories are in your path.

### iOS

- [XCode](https://developer.apple.com/xcode/)
- Command-line utilities for the iOS Simulator.

  ```
  sudo npm install -g ios-sim ios-deploy
  ```

### Desktop

To run fieldtrip on a desktop browser the runtime www directory should be served from the root of the web server. On apache this can be achieved by setting up a virtualhost, e.g (for apache 2.2):

```
<VirtualHost *:1234>
    ServerAdmin me@ed.ac.uk
    DocumentRoot /home/me/local/<runtime_dir>/www
    ErrorLog /var/log/apache2/error.log
    LogLevel info
    CustomLog /var/log/apache2/access.log combined
</VirtualHost>
```
