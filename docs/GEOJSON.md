### FT-Open Record Format Proposal

#### Introduction

In the future, we will need to support other geometries than points. Instead of trying to figure out our own polyline or polygon format it's better to follow the standards format and convert the internal record format from json to geojson.

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
        "coordinates": [<longitude>, <latitude>, <altitude> ] 
    }, 
    "name": "<record name>", 
    "properties": { 
        "data": {
            "<editor>": {
                "fields": [
                    {
                        "id": "<id>",
                        "label": "<label>",
                        "val": "<value>"
                    }
                ]
            }
        }
        "timestamp": "<timestamp>" 
    }
}
```

#### Issues

* <strong>App Migration</strong>: users might have records with the old format that needs to be transformed.

    <strong>Solution</strong>:<br/>
    For users that have upgraded the app:
    * On first start up local records are converted to the new format.
    * The first time they login they activate an upgrade script, which is part of the PCAPI, which converts records in dropbox to the new format.

* <strong>Mixed Dropbox Users</strong>: what happens if there are multiple devices with the same dropbox account and some of the devices have been upgraded to 1.4 and some not?
 
    <strong>Solution</strong>:<br/>
    - either do the conversion on the fly which is going to slow things down
        * this assumes we would not have a 1.3 and 1.4 version running parallel
    - or somehow warn them that they need to upgrade their app if they want it to be functioning

* <strong>Authoring Tool legacy support</strong> how is the Authoring Tool going to handle both formats? You might have users with the old and the new format.

    <strong>Solution</strong>:<br/>
    The Authoring Tool needs to check after the user logs in if the records are in the new or old format and choose the right version of the PCAPI for handling data. Therefore there will be a pcapi 1.3 and 1.4. (version 1.2 should be removed)

* PCAPI filters the data so needs to know the exact format of the record
    
    <strong>Solution</strong>:<br/>
    We need to support both 1.3 and 1.4 version for some time.

* <strong>Dichotomous Questions: </strong> There is a strong use case where we might have dichotomous questions which means that a record is connected to multiple forms.
 
    <strong>Solution</strong>:<br/>
    I changed the format of editor and fields. Check the proposed format and specifically check data inside the properties field.

#### Record Storage in App

In FTGB, records are stored in localstorage and the current implementation has some limitations - filtering, seaching, updating. Discussion could be had for replacing the localstorage solution with a DB solution:

* Websql: is deprecated in HTML5, see: http://www.w3.org/TR/webdatabase/
* IndexedDB: poor support in older version of webkit, see: http://caniuse.com/indexeddb

#### Extra Requirements

* It has been asked to use a linked-data geojson format. Here's an example of it
  https://github.com/geojson/geojson-ld
  That needs to be integrated with the Authoring Tool in order the user to be able
  to connect the record with linked data.
