### Fieldtrip Open Record Format Proposal

#### Existing Record Format

```
{
    "<record name>": {
        "fields": [
            {
                "id": "<id>",
                        "val": "<value>",
                        "label": "<label>"
                  }
            ],
        "name": "<record name>",
        "editor": "<editor>",
        "timestamp": "<timestamp>",
        "point": {
            "lat": <latitude>,
            "alt": <altitude>,
            "lon": <longitude>
        }
    }
}
```

#### New Record Format (GeoJSON)

```
{
    "type": "Feature", 
    "geometry": { 
        "type": "Point", 
        "coordinates": [<latitude>, <longitude> ] 
    }, 
    "name": "<record name>", 
    "properties": { 
        "editor": "<editor>", 
        "fields": [ 
            { 
                "id": "<id>", 
                "label": "<label>", 
                "val": "<value>" 
            }, 
        ], 
        "timestamp": "<timestamp>" 
    } 
}
```

#### Issues

* <strong>App Migration</strong>: users might have records with the old format that needs to be transformed.

    <strong>Solution</strong>:<br/>
    For users that have upgraded the app, the first time they login they activate an upgrade script, which is part of the PCAPI, which converts the old format to the new one.

* <strong>Mixed Dropbox user</strong>: what happens if there are multiple devices with the same dropbox account and some of the devices have been upgraded to 1.4 and some not?
 
    <strong>Solution</strong>:<br/>
    - either do the conversion on the fly which is going to slow things down
    - or somehow warn them that they need to upgrade their app if they want it to be functioning

* <strong>Authoring Tool legacy support</strong> how is the Authoring Tool going to handle both formats? You might have users with the old and the new format.

    <strong>Solution</strong>:<br/>
    The Authoring Tool needs to check after the user logs in if the records are in the new or old format and choose the right version of the PCAPI for handling data. Therefore there will be a pcapi 1.3 and 1.4. (version 1.2 should be removed)

* PCAPI filters the data so needs to know the exact format of the record
    
    <strong>Solution</strong>:<br/>
    We need to support both 1.3 and 1.4 version for some time.

#### Record Storage in App

In FTGB, records are stored in localstorage and the current implementation which has some limitations - filtering, seaching, updating. Some thought has been put into replacing the localstorage solution with a DB solution:

* Websql: is deprecated in HTML5, see: http://www.w3.org/TR/webdatabase/
* IndexedDB: poor support in older version of webkit, see: http://caniuse.com/indexeddb

#### Extra Requirements

* It has been asked to use a linked-data geojson format. Here's an example of it
  https://github.com/geojson/geojson-ld
  That needs to be integrated with the Authoring Tool in order the user to be able
  to connect the record with linked data.
