### Offline Maps

Offline Maps is a [Fieldtrip Open](https://github.com/edina/fieldtrip-open) plugin for caching maps on the device.

#### Dependencies

[cordova-plugin-file-transfer](https://github.com/apache/cordova-plugin-file-transfer) should be added to the [project plugins file](https://github.com/edina/fieldtrip-open/blob/master/PROJECTS.md#plugins).

#### Pages

##### Save Map

Page for selecting area on map to download. Example:

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
        },
        ...
```

##### Saved Maps

Page for managing previous saved maps. Example:

```
{
    "body":{
        "section1": {
            "title": "Download to Device",
            "items": {
                "item1": {
                    "div": {"class": "ui-block-a"},
                    "a": {"class": "annotate-image-form", "href": "save-map.html"},
                    "img": {"src": "theme/css/images/downloadmaps.png", "alt": "Save Maps"},
                    "title": "Maps"
                }
            }
        },
        ...
```
