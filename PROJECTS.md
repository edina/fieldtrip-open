### Projects

A project is instance of fieldtrip open. It contains a theme and a list of plugins it wishes to enable.

### Theme ###

A fieldtrip theme contains two stylesheets:

* A jQuery Mobile theme, preferably create by [ThemeRoller](http://themeroller.jquerymobile.com/). The stylesheet will be found at: theme/css/jqm-style.css
* A stylesheet for overriding the [core stylesheet](https://github.com/edina/fieldtrip-open/blob/master/src/www/css/style.css). It will be found at: theme/css/style.css

### Plugins

The json file theme/plugins.json will define a list of plugins the project wishes to enable. The following is an example:

```
{
    "cordova": [
        "cordova-plugin-device.git",
        "cordova-plugin-geolocation.git",
        "cordova-plugin-camera.git",
        "cordova-plugin-media-capture.git",
        "cordova-plugin-media.git",
        "cordova-plugin-file.git",
        "cordova-plugin-console.git"
    ],
    "fieldtrip": {
        "offline-maps": "",
        "ft-sync", "1.0.1",
        "my-plugin": "git@github.com:gmh04/fieldtrip-plugins-test.git",
    }
}
```

#### Cordova

[Cordova plugins documentation](http://cordova.apache.org/docs/en/3.3.0/guide_hybrid_plugins_index.md.html#Plugin%20Development%20Guide_native_interfaces)

#### Fieldtrip

* offline-maps: will use the master branch of the plugin found at: [https://github.com/edina/fieldtrip-plugins](https://github.com/edina/fieldtrip-plugins).
* ft-sync: will install the plugin as a [bower](http://bower.io/) dependency.
* my-plugin: will use the master branch of the plugin found at the defined git repository.

For details on fieldtrip plugin development see [plugin development documentation](PLUGINS.md).

### Templates

All HTML in fieldtrip open is [templated](https://github.com/edina/fieldtrip-open/tree/master/src/templates) and the core provides bare bone templates and data json files as a starting point for the project. In addition, plugins will also provide templates and default data files for new pages that they wish to introduce. It is the role of the project to provide the content of the main landing pages that diverges from the default layout.

#### Add New Button

TODO

#### Add New Footer Tab

TODO

### Examples

* [Basic Example](https://github.com/edina/fieldtrip-example)
* [Fieldtrip GB](https://github.com/edina/fieldtrip-gb)
* [COBWEB](https://github.com/edina/fieldtrip-cobweb)
