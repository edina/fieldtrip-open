### Fieldtrip Open Plugins

[Fieldtrip open](https://github.com/edina/fieldtrip-open) plugins allows projects to add functionality to the fieldtrip platform.

#### Core Plugins

* [Geo Fences](https://github.com/edina/fieldtrip-geo-fences)
* [GPS Tracking](https://github.com/edina/fieldtrip-gps-tracking)
* [Map Search](https://github.com/edina/fieldtrip-map-search)
* [Offline Maps](https://github.com/edina/fieldtrip-offline-maps)
* [Sync](https://github.com/edina/fieldtrip-sync)

#### Adding bespoke plugins

##### javascript

Plugins can add features or change default behaviour by creating a [requirejs](http://requirejs.org/) module in src/www/js/&#60;plugin_name&#62;.js. For example:

```
define(['map', './mymodule.js'], function(map, mymodule){
    $(document).on('pageshow', '#myplugin-page', function(){
        // do something
    });
});

```

The above snippet will load a core module map and a module named mymodule.js that will be provided by the plugin.

##### templates

All new pages added by a plugin should be created as templates in src/templates

###### settings

Settings widgets can be added by plugins by add creating a settings.html template in src/templates, e.g:

```
<div data-role="fieldcontain">
  <label for="settings-debug-gps">Debug GPS:</label>
    <select id="settings-debug-gps"
      data-role="slider"
      name="settings-entry">
      <option value="off">Off</option>
      <option value="on">On</option>
    </select>
</div>
```

The current value can be retrieved by calling the get method on the settings module, e.g:

```
define(['settings'], settings){
    if(settings.get('debug-gps')){
        // do something
    }
});

```

##### stylesheet

Plugins can add a stylesheet by via javascript, e.g:

```
$('head').prepend('<link rel="stylesheet" href="plugins/<myplugin>/css/style.css" type="text/css" />');
```


#### Release instructions

For releasing the app you need to install the packages first:
```
npm install
```
then there are 3 different versions to release: patch, minor, major. The commnad line below is using patch by default:
```
npm run release
```
For minor/major:
```
npm run minor
npm run major
```
After running the command line you've been asked a round of questions that you need to respond yes apart from the last one which is about publishing the repo on npm. This needs to be answered yes if it hasn't been published before otherwise no.

If you want to run the release without replying to all these answers you need to run:
```
npm run release -- -n
```

Now if you need to create a new fieldtrip plugin you need to add 2 packages in your devDependencies of your package.json either manually:
```
  "devDependencies": {
    "jshint": "2.5.3",
    "release-it": "0.0.15"
  },
```

or automatically:
```
npm install --save-dev jshint
npm install --save-dev release-it
```

and then add this part of code in your scripts object:
```
"lint": "node_modules/jshint/bin/jshint src/www/js/**.js",
"release": "npm run lint && node_modules/release-it/bin/release.js"
```

Finally a 3 more files need to be added:

1. .gitignore with content:
```
bower_components
node_modules
```
2. .jshintrc with content:
```
{
    "camelcase": true,
    "browser": true,
    "globalstrict": true,
    "globals": {
        "console": false,
        "define": false,
        "device": false,
        "FileTransfer": false,
        "LocalFileSystem": false,
        "localStorage": false,
        "location": false,
        "module": false,
        "navigator": false,
        "notification": false,
        "OpenLayers": false,
        "plugins": false,
        "require": false,
        "webdb": false,
        "FileTransferError": false
    },
    "multistr": true,
    "indent": "4",
    "jquery": true,
    "maxparams": "4"
}

```
3. .release.json with content:
```
{
    "non-interactive": false,
    "dry-run": false,
    "verbose": false,
    "force": false,
    "pkgFiles": ["package.json","bower.json"],
    "increment": "patch",
    "commitMessage": "Release %s",
    "tagName": "%s",
    "tagAnnotation": "Release %s",
    "buildCommand": false,
    "distRepo": false,
    "distStageDir": ".stage",
    "distBase": "dist",
    "distFiles": ["**/*"],
    "private": false,
    "publish": false,
    "publishPath": "."
}
```
