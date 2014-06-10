### Projects

A project is instance of fieldtrip open. It contains a theme and a list of plugins it wishes to enable.

### Theme ###

A fieldtrip theme contains two stylesheets:

* A jQuery Mobile theme, preferably create by [ThemeRoller](http://themeroller.jquerymobile.com/?ver=1.3.2). The stylesheet will be found at: theme/css/jqm-style.css. It is important to use the correct version and copy the images in the download zip file to theme/css/images/.
* A stylesheet for overriding the [core stylesheet](https://github.com/edina/fieldtrip-open/blob/master/src/www/css/style.css). It will be found at: theme/css/style.css

### Plugins

The json file theme/project.json will define a list of plugins the project wishes to enable. The following is an example:

```
{
    ...
    "plugins": {
        "cordova": [
            "org.apache.cordova.camera@0.2.7",
            "org.apache.cordova.console@0.2.7",
            "org.apache.cordova.device@0.2.8",
            "org.apache.cordova.file@1.0.0",
            "org.apache.cordova.file-transfer@0.4.1",
            "org.apache.cordova.geolocation@0.3.6",
            "org.apache.cordova.inappbrowser@0.3.1",
            "org.apache.cordova.media@0.2.8",
            "org.apache.cordova.media-capture@0.2.7"
        ],
        "fieldtrip": {
            "offline-maps": "0.0.1",
            "sync", "git@github.com:edina/fieldtrip-sync.git",
            "gps-tracking": "git@github.com:edina/fieldtrip-gps-tracking.git -b mybranch"
        }
    }
}
```

#### Cordova

[Cordova plugins documentation](http://cordova.apache.org/docs/en/3.3.0/guide_hybrid_plugins_index.md.html#Plugin%20Development%20Guide_native_interfaces)

#### Fieldtrip

* offline-maps: will use the release tagged 0.0.1.
* sync: will use the master branch of the plugin found at the defined git repository.
* gps-tracking: will use the mybranch branch of the defined git repository.

For details on fieldtrip plugin development see [plugin development documentation](PLUGINS.md).

### Templates

All HTML in fieldtrip open is [templated](https://github.com/edina/fieldtrip-open/tree/master/src/templates) with the core providing bare bone templates and data json files as a starting point for a project. In addition, plugins can also provide templates and default data files for new pages that they wish to introduce to the app. It is the role of the project to provide the content of the main landing pages that diverge from the default layout.

#### Add New Button

A project can add a new button to the _Home_ page by adding an index.json to src/templates. The following json object adds a _Saved_ button that will open saved-maps.html when clicked:

```
{
    "body": {
        "section1": {
            "items": {
                "item2": {
                    "div": {"class": "ui-block-b"},
                    "a": {"href": "saved-maps.html"},
                    "img": {"src": "css/images/saved.png", "alt": "Save Map"},
                    "title": "Saved"
                }
            }
        }
    }
}
```

* section1: refers to the _Maps_ section of the _Home_ page
* item2: is the id of the button and should be unique if the button is new or the same if replacing an existing button
* ui-block-b: places the button in the second column of the section, see [JQM Grid Layout docs](http://api.jquerymobile.com/grid-layout/#Grid%20Layout)

A project can add a new button to the _Capture_ page by adding an capture.json in src/templates.

#### Add Header Button

A project or plugin can add a new button to the main header of the app by adding the following to the page json file where it should appear:

```
{
    "header": {
        "buttons" : {
            "exit": {
                "id": "home-exit",
                "data-role": "button",
                "data-inline": "true",
                "data-transition": "none",
                "value": "Exit"
            }
        }
    }
    ...
}
```

#### Add New Footer Tab

A project can add a new footer new tab, and landing page for the tab, by providing a footer.json in src/templates. The following json object adds a _Download_ tab that will open download.html when clicked:

```
{
    "download": {
        "name": "Download",
        "href": "download.html",
        "class": "download-button",
        "data-icon": "custom"
    }
}
```

#### Removing Elements

For overriding/getting rid of elements on the core system (e.g. the footer on index page or some of the buttons of the main body) you need to add empty objects on the index.json, for example:
```
"footer" : {},
"body": {
	"sections":
    	{"items" : {"item1" : ""}
     }
 }
```

For a fuller example see: https://github.com/edina/spatial-memories/blob/master/src/templates/index.json.

#### Generate HTML

The generate_html fabric task will need to be run after a change to templates or data files:

```
fab generate_html
```

### Examples

* [Basic Example](https://github.com/edina/fieldtrip-example)
* [Botani Tours](https://github.com/edina/botanitours)
* [COBWEB](https://github.com/cobweb-eu/fieldtrip-cobweb)
* [Fieldtrip GB](https://github.com/edina/fieldtrip-gb)
* [Spatial Memories](https://github.com/edina/spatial-memories)
