The following outlines the steps for getting Fieldtrip Open development environment setup on a *nix machine.

### [html5lib](https://pypi.python.org/pypi/html5lib) dependencies

#### apt

```
sudo apt-get install python-setuptools python2.7-dev wget
```

#### RPM

TODO

#### MAC (with homebrew)

sudo brew install wget

### [Pip](https://pypi.python.org/pypi/pip)

```
sudo easy_install pip
```

### [Fabric](http://docs.fabfile.org) and related dependencies:

```
sudo pip install fabric jinja2 beautifulsoup4 html5lib
```

### nodejs (must be installed locally)

[nodejs install](https://github.com/joyent/node/wiki/installation)

```
npm install -g cordova bower
```

### Android SDK

[Android install](http://developer.android.com/sdk/index.html)

Ensure the sdk/tools directory is in your path.

### IOS

TODO

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

