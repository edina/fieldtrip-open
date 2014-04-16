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

The current value can be retieved by calling the get method on the settings module, e.g:

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
