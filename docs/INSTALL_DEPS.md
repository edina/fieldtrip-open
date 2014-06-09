# Dependencies

### Python and NodeJS

Use your favorite package manager to install:

- [Python 2.7](https://www.python.org/download/releases/2.7)
- [Pip](https://pypi.python.org/pypi/pip)
- [nodejs](http://nodejs.org/)
- [npm](https://www.npmjs.org/)
- [Apache Ant](http://ant.apache.org/) (for android deploy)
- [wget](https://www.gnu.org/software/wget/) (OSX)

#### Linux

##### Ubuntu / Debian
```
sudo apt-get install python-setuptools python2.7-dev nodejs npm
sudo apt-get ant
```

#### OSX

##### Macports

```
sudo port install python27 py27-pip nodejs npm
sudo port install apache-ant
sudo port install wget
```

##### Brew
```
brew install python node
brew install ant
brew install wget
```

### Apache Cordoba

Install Apache Cordova

```
sudo npm install -g cordova
```

### Fabric

Install some libraries used for the deploy:

```
sudo pip install fabric jinja2 beautifulsoup4 html5lib
sudo npm install -g bower
```

## Target Platforms


### Android

[Android install](http://developer.android.com/sdk/installing/index.html)

Ensure the sdk/tools directory is in your path.

### iOS

- [XCode](https://developer.apple.com/xcode/)
- Command-line utilities for the iOS Simulator.

  ```
  sudo npm install -g ios-sim ios-deploy
  ```

### Desktop

To run fieldtrip on a desktop browser the runtime www directory should be served from the root of the web server. On apache this can be achieved by setting up a virtualhost, e.g:

```
<VirtualHost *:1234>
    ServerAdmin me@ed.ac.uk
    DocumentRoot /home/me/local/<runtime_dir>/www
    ErrorLog /var/log/apache2/error.log
    LogLevel info
    CustomLog /var/log/apache2/access.log combined
</VirtualHost>
```
