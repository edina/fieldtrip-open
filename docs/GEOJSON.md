### FTOPEN GEOJSON FORMAT

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

#### New Record Format (GeoJSON-)

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
                "id": "fieldcontain-select-1", 
                "label": "Floodies", 
                "val": "Lake" 
            }, 
        ], 
        "timestamp": "2014-05-26T11:40:48.217Z" 
    } 
}
```

#### Issues

* PCAPI filters the data so needs to know the exact format of the record
* People might have records with the old format that needs to be transformed.
* What happens if there are multiple devices with the same dropbox account and
some of the devices have been upgraded to 1.4 and some not?
* How is the Authoring Tool going to handle both formats? You might have users with
the old and the new format.


#### Potential Solution
* Basically, we need to support both 1.3 and 1.4 version for some time. 
* For users that have been upgraded the app the first time they login they
activate the upgrade script which is part of the PCAPI which converts the old
format to the new one.
* About users with shared account and multiple versions of the app we need to
    - either do the conversion on the fly which is going to slow things down
    - or somehow warn them that they need to upgrade their app if they want it to
    be functioning.
* The Authoring Tool needs to check after the user logs in if the records are
in the new or old format and choose the right version of the PCAPI for handling
data.

