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

##### stylesheet

Plugins can add a stylesheet by via javascript, e.g:

```
$('head').prepend('<link rel="stylesheet" href="plugins/<myplugin>/css/style.css" type="text/css" />');
```


##### settings

The application offers the opportunity to add some options on the settings page of the application. Specifically, plugins such as [Offline Maps](https://github.com/edina/fieldtrip-offline-maps) and [Sync](https://github.com/edina/fieldtrip-sync) need to have a way of changing the urls they use without having to expose them to the version control for obvious reasons.

Thus they need to be added to the config.ini and from there they will be generated to the final settings.html inside the www folder. For each plugin a variable (the name of the variable needs to have the same name with the plugin) inside the config.ini needs to be added and a settings.html templated needs to be constructed inside the src/templates folder of the plugin. 
e.g.
https://github.com/edina/fieldtrip-sync/blob/master/src/templates/settings.html

After the 
```
$ fab generate_html
```
command is run all the settings snippets are added to the final settings.html file.