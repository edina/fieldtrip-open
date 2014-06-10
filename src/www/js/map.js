/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

define(['ext/openlayers', 'records', 'utils', 'proj4js'], function(ol, records, utils, proj4js){
    var RESOLUTIONS = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
    var MIN_LOCATE_ZOOM_TO = RESOLUTIONS.length - 3;
    var POST_LOCATE_ZOOM_TO = RESOLUTIONS.length - 1;

    var INTERNAL_PROJECTION;
    var EXTERNAL_PROJECTION = new OpenLayers.Projection("EPSG:4326")
    var TMS_URL = "/mapcache/tms";
    var DEFAULT_USER_LON = -2.421976;
    var DEFAULT_USER_LAT = 53.825564;
    //var GPS_LOCATE_TIMEOUT = 10000;
    var GPS_LOCATE_TIMEOUT = 3000;

    var tileMapCapabilities;
    var serviceVersion = "1.0.0"; // TODO needs parameterised

    var ANNOTATE_POSITION_ATTR = 'annotate_pos';
    var USER_POSITION_ATTR = 'user_pos';

    var mapSettings = utils.getMapSettings();
    var baseLayer;
    if(mapSettings.baseLayer === 'osm'){
        INTERNAL_PROJECTION = new OpenLayers.Projection('EPSG:900913')
        baseLayer = new OpenLayers.Layer.OSM();
    }
    else{
        var proj = mapSettings.epsg;
        proj4js.defs[proj] = mapSettings.proj;
        INTERNAL_PROJECTION = new OpenLayers.Projection(proj)
        baseLayer = new OpenLayers.Layer.TMS(
            "osOpen",
            mapSettings.url + TMS_URL,
            {
                layername: mapSettings.layerName,
                type: mapSettings.type,
                serviceVersion: mapSettings.version,
                isBaseLayer: true,
            }
        );
    }

    /**
     * Fetch TMS capabilities from server and store as this.tileMapCapabilities.
     */
    var fetchCapabilities = function(){
        var map = _this.map;
        var baseLayerName = map.baseLayer.layername;

        var applyDefaults = $.proxy(function(){
            tileMapCapabilities = {'tileSet': []};
            tileMapCapabilities.tileFormat = {
                'height': 256,
                'width': 256
            }
            tileMapCapabilities.tileSet = RESOLUTIONS;
        }, this);

        if(baseLayerName){
            _this.baseMapFullURL = _this.getTMSURL() + serviceVersion + '/' + baseLayerName + '/';

            // fetch capabilities
            $.ajax({
                type: "GET",
                url: utils.getMapServerUrl() + serviceVersion + '/' + baseLayerName + '/',
                dataType: "xml",
                timeout: 10000,
                success: $.proxy(function(xml) {
                    var tileFormat = $(xml).find('TileFormat')[0];
                    this.tileMapCapabilities.tileFormat = {
                        'height': $(tileFormat).attr('height'),
                        'width': $(tileFormat).attr('width')
                    }

                    $(xml).find('TileSet').each($.proxy(function(i, element){
                        // store units per pixel of each zoom level
                        this.tileMapCapabilities.tileSet[i] = $(element).attr('units-per-pixel');
                    }, this));

                    if(this.tileMapCapabilities.tileSet.length === 0){
                        console.debug("Capabilities does not contain tileset details. Use defaults.");
                        applyDefaults();
                    }
                }, this),
                error: function(){
                    console.debug("Capabilities not found. Use defaults.");
                    applyDefaults();
                }
            });
        }
        else{
            applyDefaults();
        }
    };

    /**
     * Display all annotations on speficied layer.
     * @param layer The layer to use.
     */
    var showAnnotations = function(layer){
        var features = [];


        $.each(records.getSavedRecords(), function(id, annotation){
            var record = annotation.record;
            console.log("type:" + annotation.type ) ;
            if(record.point !== undefined){
                features.push(new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.Point(record.point.lon,
                                                  record.point.lat),
                    {
                        'id': id,
                        'type': records.getEditorId(annotation)
                    }
                ));
            }
            else{
                console.debug("record " + id + " has no location");
            }
        });

        layer.addFeatures(features);
        
        if (layer.getVisibility())
        {
         addAltTextToFeatureMarkers(features) ; // markers only available after features added to layer
        }
    };

    
    
    
    /**
     * Display track annotations on speficied layer.
     * @param layer The layer to use.
     */
    var showTrackAnnotations = function(layer){
        var features = [];


        $.each(records.getSavedRecords(), function(id, annotation){
            var record = annotation.record;
            console.log("type:" + annotation.type ) ;
            if(record.point !== undefined && records.isTrack(annotation)){
                features.push(new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.Point(record.point.lon,
                                                  record.point.lat),
                    {
                        'id': id,
                        'type': records.getEditorId(annotation)
                    }
                ));
            }
            else{
                console.debug("record " + id + " has no location or has no track");
            }
        });

        layer.addFeatures(features);
      
      
        if (layer.getVisibility())
        {
            addAltTextToFeatureMarkers(features) ;
            
        }
    
    };
    
    /**
     * Display annotations for specified track on speficied layer.
     * @param layer The layer to use.
     * @param trackId The id of track for which to show records
     */
    var showAnnotationsForTrack = function(layer, trackId){
        var features = [];

        // utils.printObj(records.getSavedRecords());

        $.each(records.getSavedRecordsForTrack(trackId), function(id, annotation){
            var record = annotation.record;
            console.log("type:" + annotation.type ) ;
            if(record.point !== undefined ){
                features.push(new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.Point(record.point.lon,
                                                  record.point.lat),
                    {
                        'id': id,
                        'type': records.getEditorId(annotation)
                    }
                ));
            }
            else{
                console.debug("record " + id + " has no location or has no track");
            }
        });

        layer.addFeatures(features);
        
        if (layer.getVisibility())
        {
          addAltTextToFeatureMarkers(features) ; // markers only available after features added to layer
        }
        
        
    };
    
    var addAltTextToFeatureMarkers = function(features)
    {
         console.debug("features:" + features) ;
        utils.inform("test message", 1000) ;
        $.each(features, function(index, feature){
                
                var featureMarkerElement = document.getElementById(feature.geometry.id) ;
                 // set alt tag for the marker
                 var record = records.getSavedRecord(feature.attributes.id) ;
                 if (record !== undefined && record !== null) {
                    
                 
                   var name =  record.record.name ;
                   var description = record.record.fields[0].val ;
                   var altText = feature.attributes.type ;
                   if (description != undefined && description.length > 4 && altText !== "track")
                   {
                    
                      altText = altText + " " + description ;
                   }
                                 
                   if (featureMarkerElement !== null && featureMarkerElement !== undefined)
                   {
                      
                      featureMarkerElement.setAttribute("alt", altText);
                      featureMarkerElement.setAttribute("aria-label", altText);
                      featureMarkerElement.setAttribute("role", "button");
                      if (feature.attributes.type === "track") {
                          featureMarkerElement.setAttribute("tabindex", 1);
                      }
                      else
                      {
                          featureMarkerElement.setAttribute("tabindex", index + 2);
                      }
                   }
                    
                 }
                
            }) ;
        
    };


var _this = {

    /**
     * Enable high accuracy flag.
     */
    GPS_ACCURACY_FLAG: true,

    /**
     * Override default lon lat values
     */
    overrideDefaultLonLat: function(lon, lat){
        DEFAULT_USER_LON = lon;
        DEFAULT_USER_LAT = lat;
    },

    /**
     * Set up openlayer map.
     */
    init: function(){
        this.recordClickListeners = {};
        var options = {
            controls: [],
            projection: INTERNAL_PROJECTION,
            units: 'm',
            resolutions: RESOLUTIONS,
            maxExtent: new OpenLayers.Bounds (0,0,700000,1300000),
            theme: null,
        }

        this.map = new OpenLayers.Map("map", options);
        this.map.addLayer(baseLayer);

        // styles for records
        var recordsStyle = new OpenLayers.Style({
            pointRadius: 20,
            // labels don't work on android
            //label : "${title}",
            graphicOpacity: 1,
            graphicZIndex: 1
        });

        // annotation styles
        recordsStyle.addRules([
            new OpenLayers.Rule({
                filter: new OpenLayers.Filter.Comparison({
                    type: OpenLayers.Filter.Comparison.EQUAL_TO,
                    property: 'type',
                    value: 'audio',
                }),
                symbolizer: {
                    externalGraphic: 'css/images/audiomarker.png',
                    graphicWidth: 35,
                    graphicHeight: 50,
                    graphicYOffset: -50
                }
            }),
            new OpenLayers.Rule({
                filter: new OpenLayers.Filter.Comparison({
                    type: OpenLayers.Filter.Comparison.EQUAL_TO,
                    property: 'type',
                    value: 'image',
                }),
                symbolizer: {
                    externalGraphic: 'css/images/imagemarker.png',
                    graphicWidth: 35,
                    graphicHeight: 50,
                    graphicYOffset: -50
                }
            }),
            new OpenLayers.Rule({
                filter: new OpenLayers.Filter.Comparison({
                    type: OpenLayers.Filter.Comparison.EQUAL_TO,
                    property: 'type',
                    value: 'text',
                }),
                symbolizer: {
                    externalGraphic: 'css/images/textmarker.png',
                    graphicWidth: 35,
                    graphicHeight: 50,
                    graphicYOffset: -50
                }
            }),
            // an annotation with no photo, text or audio is a custom annotations
            new OpenLayers.Rule({
                elseFilter: true,
                symbolizer: {
                    externalGraphic: 'css/images/custommarker.png',
                    graphicWidth: 35,
                    graphicHeight: 50,
                    graphicYOffset: -50
                }
            })
        ]);

        // vector layer for displaying records
        var styleMap = new OpenLayers.StyleMap({'default': recordsStyle});
        var recordsLayer = new OpenLayers.Layer.Vector(
            'recordsLayer',
            {
                visibility: false,
                styleMap: styleMap
            }
        );

        // vector layer for dragging position marker
        var positionMarkerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        positionMarkerStyle.graphicOpacity = 1;
        positionMarkerStyle.graphicWidth = 65;
        positionMarkerStyle.graphicHeight = 64;
        positionMarkerStyle.externalGraphic = "css/images/marker.png";
        positionMarkerStyle.graphicYOffset = -64;

        var positionMarkerLayer = new OpenLayers.Layer.Vector(
            'positionMarker',
            {
                style: positionMarkerStyle,
                visibility: false
            }
        );

        // user location layer
        var locateLayerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        locateLayerStyle.externalGraphic = "css/images/user.png";
        locateLayerStyle.graphicWidth = 40;
        locateLayerStyle.graphicHeight = 40;
        locateLayerStyle.graphicOpacity = 1;
        locateLayerStyle.rotation = "${imageRotation}";
        var locateLayer = new OpenLayers.Layer.Vector(
            'locate',
            {
                style: locateLayerStyle,
                renderers: ["Canvas"]
            }
        );

        // add layers to map
        this.map.addLayers([positionMarkerLayer,
                            recordsLayer,
                            locateLayer]);
        
        locateLayer.div.setAttribute("alt" , "location marker") ;

        var TN = OpenLayers.Class(OpenLayers.Control.TouchNavigation, {
            defaultClick: $.proxy(this.showRecordDetail, this),
        });

        // this will allow non apps to work
        var select = new OpenLayers.Control.SelectFeature(recordsLayer);
        this.map.addControl(select);
        select.activate();

        this.map.addControl(new OpenLayers.Control.Attribution());
        this.map.addControl(new TN({
            dragPanOptions: {
                enableKinetic: true
            },
            pinchZoomOptions: {
                autoActivate: true
            }
        }));

        this.map.addControl(new OpenLayers.Control.ScaleLine({geodesic: true}));

        // create default user position
        this.userLonLat = new OpenLayers.LonLat(
            DEFAULT_USER_LON,
            DEFAULT_USER_LAT);
        this.userLonLat.gpsPosition = {
            longitude: DEFAULT_USER_LON,
            latitude: DEFAULT_USER_LAT,
            heading: 130,
            altitude: 150
        };

        var drag = new OpenLayers.Control.DragFeature(positionMarkerLayer);
        this.map.addControl(drag);
        drag.activate();

        this.setCentre(DEFAULT_USER_LON,
                       DEFAULT_USER_LAT,
                       MIN_LOCATE_ZOOM_TO,
                       true);
    },

    /**
     * TODO
     */
    postInit: function(){
        fetchCapabilities();
    },

    /**
     * TODO
     */
    addLayer: function(options){
        // TODO - should support more styles
        if(typeof(options.style.colour) === 'undefined'){
            options.style.colour = 'black';
        }
        if(typeof(options.style.strokeWidth) === 'undefined'){
            options.style.strokeWidth = 2;
        }
        if(typeof(options.visible) === 'undefined'){
            options.visible = false;
        }
        var olStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        olStyle.fillOpacity = 0;
        olStyle.strokeWidth = options.style.strokeWidth;
        olStyle.strokeColor = options.style.colour;

        var layer = new OpenLayers.Layer.Vector(
            options.id,
            {
                visibility: options.visible,
                style: olStyle,
            }
        );

        this.map.addLayer(layer);

        return layer;
    },

    /**
     * TODO
     */
    addGPXLayer: function(options){
        var layer = new OpenLayers.Layer.Vector(
            options.id,
            {
                strategies: [new OpenLayers.Strategy.Fixed()],
                protocol: new OpenLayers.Protocol.HTTP({
                    url: options.url,
                    format: new OpenLayers.Format.GPX()
                }),
                style: {
                    strokeColor: options.style.colour,
                    strokeWidth: 5,
                    strokeOpacity: 1
                },
                projection: EXTERNAL_PROJECTION
            }
        );

        this.map.addLayer(layer);
        return layer;
    },

    /**
     * Allow a plugin to listen for click events
     */
    addRecordClickListener: function(listener){
       
          this.recordClickListeners[listener.name] = listener.callback ;
    },

    /**
     * Add a new style record icons.
     * @param options
     *   type - the record type
     *   image - path to record image
     */
    addRecordStyle: function(options){
        var rule = new OpenLayers.Rule({
            filter: new OpenLayers.Filter.Comparison({
                type: OpenLayers.Filter.Comparison.EQUAL_TO,
                property: 'type',
                value: options.type,
            }),
            symbolizer: {
                externalGraphic: options.image,
                graphicWidth: 35,
                graphicHeight: 50,
                graphicYOffset: -50
            }
        });

        this.getRecordsLayer().styleMap.styles["default"].rules.push(rule);
    },

    /**
     * Render the map on a defined div.
     * @param div The div id.
     */
    display: function(div){
        this.map.render(div);
    },

    /**
     * @return layer with the draggable icon.
     */
    getAnnotateLayer: function(){
        return this.getLayer('positionMarker');
    },

    /**
     * get current annotation coords.
     * @param wgs84 In WGS84? If not national grid.
     * @return Current annotation coordinates.
     */
    getAnnotationCoords: function(wgs84){
        var coords = undefined;
        var features = this.getAnnotateLayer().getFeaturesByAttribute(
            'id',
            ANNOTATE_POSITION_ATTR);

        if(features.length > 0){
            var geom = features[0].geometry;
            coords = new OpenLayers.LonLat(geom.x, geom.y);
            if(wgs84){
                coords = this.toExternal(coords);
            }

            // give the annotation altitude the altitude of the user
            // see https://redmine.edina.ac.uk/issues/5497
            coords.gpsPosition = this.userLonLat.gpsPosition;
        }

        return coords;
    },

    /**
     * @return openlayers base layer.
     */
    getBaseLayer: function(){
        return this.map.baseLayer;
    },

    /**
     * @return openlayers base layer.
     */
    getBaseMapFullURL: function(){
        return this.baseMapFullURL;
    },


    /**
     * Get the current centre and zoom level of the map.
     * @param wgs84 In WGS84?
     * @returns:
     * {Object} Object with two properties: centre and zoom level.
     */
    getCentre: function(wgs84){
        var centre = this.map.getCenter();

        if(wgs84){
            centre = toWGS84(centre);
        }

        return {
            centre: centre,
            zoom: this.map.getZoom(),
        }
    },

    /**
     * @return layer with the user icon.
     */
    getLocateLayer: function(){
        return this.getLayer('locate');
    },

    /**
     * @param layerName
     * @return Openlayers layer by name.
     */
    getLayer: function(layerName){
        var layer = this.map.getLayersByName(layerName);

        if(layer){
            return layer[0];
        }
        else{
            return;
        }
    },

    /**
     * @return map options
     */
    getOptions: function(){
        return this.map.options;
    },

    /**
     * @return Records vector layer.
     */
    getRecordsLayer: function(){
        return this.getLayer('recordsLayer');
    },

    /**
     * @return Base stack type.
     */
    getStackType: function(){
        return this.getTileMapCapabilities()['stack'];
    },

    /**
     * @return The tile file type of the base layer.
     */
    getTileFileType: function(){
        return this.getBaseLayer().type;
    },

    /**
     * @return The full URL to the TMS server.
     */
    getTMSURL: function(root){
        if(!root){
            root = utils.getMapServerUrl();
        }
        return root += TMS_URL;
    },

    /**
     * @return The coordinates of the user, based on the last geolocate.
     * ({<OpenLayers.LonLat>})
     */
    getUserCoords: function(external){
        return this.toInternal(this.userLonLat);
    },

    /**
     * @return The coordinates of the user, based on the last geolocate, in
     * external projection.
     * ({<OpenLayers.LonLat>})
     */
    getUserCoordsExternal: function(external){
        return this.userLonLat;
    },

    /**
     * Locate user on map.
     * @param interval Time gap between updates. If 0 update only once.
     * @param secretly If true do not show page loading msg.
     * @param updateAnnotateLayer Should annotate layer be informed of new position?
     * @param useDefault If no user location found should default be used?
     */
    geoLocate: function(options){
        console.debug("Geolocate user: interval: " + options.interval +
                      " secretly: " + options.secretly +
                      " updateAnnotateLayer: " + options.updateAnnotateLayer +
                      " useDefault " + options.useDefault);

        if(!options.secretly){
            utils.inform('Waiting for GPS fix',10000);
        }

        // found user location
        var onSuccess = $.proxy(function(position){
            console.debug("Position found: "+ position.coords.latitude + "," + position.coords.longitude);
            this.onPositionSuccess(position, options.updateAnnotateLayer);
            $.mobile.hidePageLoadingMsg();
        }, this);

        // problem with geo locate
        var onError = $.proxy(function(error){
            if(error.code === 3){
                // timeout
                console.debug("GPS timed out: " + error.code);
                if(!options.secretly){
                    utils.inform('GPS timed out');
                }
            }
            else{
                console.debug("GPS is not enabled");
                if(!options.secretly){
                    utils.inform('Your GPS needs to be enabled.', 5000);
                }
            }

            if(options.useDefault){
                //  just go to center of UK
                var pos = {
                    coords: {
                        longitude: DEFAULT_USER_LON,
                        latitude: DEFAULT_USER_LAT,
                        heading: 130,
                        altitude: 150
                    }
                }

                var dontHideLoadingDialog = true;
                this.onPositionSuccess(pos,
                                       options.updateAnnotateLayer,
                                       dontHideLoadingDialog);
            }
        }, this);

        // clear watch if already defined
        if(this.geoLocationWatchID){
            navigator.geolocation.clearWatch(this.geoLocationWatchID);
        }

        // if interval is defined create a watch
        if(options.interval > 0){
            this.geoLocationWatchID = navigator.geolocation.watchPosition(
                onSuccess,
                onError,
                {
                    enableHighAccuracy: this.GPS_ACCURACY_FLAG,
                    maximumAge: options.interval,
                    timeout: this.geolocateTimeout
                }
            );
        }
        else{
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                onError,
                {
                    enableHighAccuracy: this.GPS_ACCURACY_FLAG,
                    timeout: this.geolocateTimeout
                }
            );
        }
    },

    /**
     * TODO
     */
    geolocateTimeout: GPS_LOCATE_TIMEOUT,

    /**
     * @return Current map extent ({<OpenLayers.Bounds>}).
     */
    getExtent: function(){
        return this.map.getExtent();
    },

    /**
     * Get the current location of the device.
     * @callback Function executed when position is found.
     */
    getLocation: function(callback){
        navigator.geolocation.getCurrentPosition(
            function(position){
                callback(position);
            },
            function(){
                callback({
                    coords: {
                        longitude: DEFAULT_USER_LON,
                        latitude: DEFAULT_USER_LAT,
                        heading: 130,
                        altitude: 150
                    }
                });
            },
            {
                enableHighAccuracy: this.GPS_ACCURACY_FLAG,
                timeout: this.geolocateTimeout
            }
        );
    },

    /**
     * @return The map tileset capabilities object.
     */
    getTileMapCapabilities: function(){
        return tileMapCapabilities;
    },

    /**
     * @return Zoom level details.
     */
    getZoomLevels: function(){
        return {
            current: this.map.getZoom(),
            max: this.map.getNumZoomLevels() - 1
        }
    },

    /**
     * Hide annotation layer.
     */
    hideAnnotateLayer: function(){
        this.hideLayer(this.getAnnotateLayer());
    },

    /**
     * Hide map layer.
     * @param layer - the layer to hide.
     */
    hideLayer: function(layer){
        layer.setVisibility(false);
    },

    /**
     * Remove all annotations / records from map.
     */
    hideRecordsLayer: function(){
        this.getRecordsLayer().setVisibility(false);

        $.each(this.map.layers, function(i, layer){
            // GPS tracks are on a seperate layer beginning with 'gps-track-'
            if(layer.name.substr(0, 10) === 'gps-track-'){
                layer.setVisibility(false);
            }
        });
    },

    /**
     * check if the base layer is TMS or not
     */
    isBaseLayerTMS: function(){
        return this.getBaseLayer() instanceof OpenLayers.Layer.TMS;
    },

    /**
     * Receive a new user position.
     * @param position The GPS position http://docs.phonegap.com/en/2.1.0/cordova_geolocation_geolocation.md.html#Position.
     * @param updateAnnotateLayer Should annotate layer be updated after position
     * success?
     */
    onPositionSuccess: function(position,
                                updateAnnotateLayer,
                                dontHideLoadingDialog){
        this.userLonLat = new OpenLayers.LonLat(
            position.coords.longitude,
            position.coords.latitude);
        this.userLonLat.gpsPosition = position.coords;

        if(position.coords.heading){
            if(this.getAnnotateLayer().features.length > 0){
                // set rotation to heading direction, doesn't work opn most android
                // devices, see http://devel.edina.ac.uk:7775/issues/4852
                this.getAnnotateLayer().features[0].attributes.imageRotation =
                    360 - position.coords.heading;
            }
        }

        // update user position
        this.updateLocateLayer();

        // if necessary update annotate pin
        if(updateAnnotateLayer){
            // TODO
            this.updateAnnotateLayer(this.toInternal(this.userLonLat));
            //this.updateAnnotateLayer(this.userLonLat);

        }
        if(dontHideLoadingDialog !== true){
            $.mobile.hidePageLoadingMsg();
        }
    },

    /**
     * Covert a point object to external projection.
     * @param point A point object with internal projection.
     */
    pointToExternal: function(point){
        var lonLat = this.toExternal(new OpenLayers.LonLat(point.lon, point.lat));
        point.lon = lonLat.lon;
        point.lat = lonLat.lat;
    },

    /**
     * Covert a point object to internal projection.
     * @param point A point object with external projection.
     * @return A point object reprojected to internal projection.
     */
    pointToInternal: function(point){
        var retValue;
        var lonLat;
        if(typeof(point.longitude) === 'undefined'){
            lonLat = this.toInternal(
                new OpenLayers.LonLat(point.lon, point.lat));
            retValue = {
                'lon': lonLat.lon,
                'lat': lonLat.lat
            };
        }
        else{
            lonLat = this.toInternal(
                new OpenLayers.LonLat(point.longitude, point.latitude));
            retValue = {
                'longitude': lonLat.lon,
                'latitude': lonLat.lat
            };
        }

        return retValue;
    },

    /**
     * Sledgehammer approach to refreshing annotations.
     * @param annotation The annotation to centre on.
     */
    refreshRecords: function(annotation){
        this.getRecordsLayer().removeAllFeatures();
        this.showRecordsLayer(annotation);
    },

    /**
     * Register an object and function to recieve map zoom change updates.
     * @param obj
     * @param func
     */
    registerZoom: function(obj, func){
        this.map.events.register('zoomend', obj, func);
    },

    
    /**
     * TODO
     */
    registerTileLoad: function(obj) {
    
    
     
        this.map.layers[0].events.register('tileloaded', this.map.layers[0], function(evt){
                
                // console.debug("tile loaded:" + evt.div) ;
                evt.tile.imgDiv.setAttribute("role", "presentation")
                evt.tile.imgDiv.alt="map tile" ;
               
            });
    
    },
    
    /**
     * TODO
     */
    removeAllFeatures: function(layer){
        layer.removeAllFeatures();
        
    },

    /**
     * TODO
     */
    removeLayer: function(layer){
        this.map.removeLayer(layer);
    },

    /**
     * TODO
     */
    setBaseLayer: function(layer){
        baseLayer = layer;
    },

    /**
     * Centre map with zoom level.
     * @param lon
     * @param lat
     * @param zoom
     * @param wgs84
     */
    setCentre: function(lon, lat, zoom, wgs84){
        var lonlat;
        if(wgs84){
            lonlat = this.toInternal(new OpenLayers.LonLat(lon, lat));
        }
        else{
            lonlat = new OpenLayers.LonLat(lon, lat);
        }

        if(!zoom){
            zoom = this.map.getZoom();
        }

        this.map.setCenter(lonlat, zoom);
    },

    /**
     * Set centre of the map with a comma separated lon lat string
     * @params lonLatStr The point to centre on as a comma seperated string
     * @zoom The new zoom level
     * @wgs84 Is the point in wgs84 projection?
     */
    setCentreStr: function(lonLatStr, zoom, wgs84){
        var lonLat = lonLatStr.split(',');
        this.setCentre(lonLat[0], lonLat[1], zoom, wgs84);
    },

    /**
     * Show annotation marker.
     */
    showAnnotateLayer: function(){
        this.getAnnotateLayer().setVisibility(true);
    },

    /**
     * Add bounding box to layer and centre map.
     * @param options:
     *   layer - the layer to add box to
     *   bound - the bbox bounds
     *   poi - the point of interest to centre on
     */
    showBBox: function(options){
        var layer = options.layer;
        var bounds = options.bounds;
        var poi = options.poi;

        layer.removeAllFeatures();
        var geom = new OpenLayers.Bounds(bounds.left,
                                         bounds.bottom,
                                         bounds.right,
                                         bounds.top).toGeometry();

        layer.addFeatures([new OpenLayers.Feature.Vector(geom)]);

        this.setCentre(poi.centre.lon, poi.centre.lat, poi.zoom);
        this.map.zoomTo(this.map.getZoom() - 2);
    },

    /**
     * Show user's position.
     */
    showLocateLayer: function(){
        this.getLocateLayer().setVisibility(true);
    },


    /**
     * createPopup
     * Populates an annotation popup with details of the passed annotation
     * Note that you still have to pop it up manually after this step
     */
    createPopup: function(annotation) {

        var popup =  $('#map-record-popup');

        
        
        popup.off('popupbeforeposition');
        popup.on({
            popupbeforeposition: function() {
                var showRecord = function(html){
                    $('#map-record-popup-text').append(html).trigger('create');
                };

                $('#map-record-popup h1').text(annotation.record.name);
                sessionStorage.setItem('toBeDeleted',records.getAnnotationIdFromSavedRecords(annotation));
                $('#map-record-popup-text').text('');

                $.each(annotation.record.fields, function(i, entry){
                    var html;
                    var type = records.typeFromId(entry.id);

                    if(type === 'image'){
                        html = '<img src="' + entry.val + '" alt='+annotation.record.name+'"/>';
                        showRecord(html);
                    }
                    else if(type === 'audio'){
                        require(['audio'], function(audio){
                            html = audio.getNode(entry.val, entry.label + ':');
                            showRecord(html);
                        });
                    }
                    else if(entry.id !== 'text0'){ // ignore title element
                        html = '<p><span>' + entry.label + '</span>: ' +
                    entry.val + '</p>';
                showRecord(html);
                    }
                });
            }
        });

        // Close popup on click
        $('#close-popup').on('click',  function() {
            popup.popup('close');
        });
        // delete a saved record
        $(document).off('click', '.saved-records-delete');
        $(document).on(
            'click',
            '.saved-records-delete',
            $.proxy(function(event){
                
                //Close existing popup and open delete confirmation
                popup.popup('close');
                popup.on( "popupafterclose", function( event, ui ) {                  
                     $('#saved-records-delete-popup').popup('open');
                });
               
            }, this)
        );

        // delete confirm
        $('#saved-record-delete-confirm').click($.proxy(function(event){
           
            var id = sessionStorage.getItem('toBeDeleted');
            sessionStorage.removeItem('toBeDeleted');
            records.deleteAnnotation(id, true);
            this.refreshRecords();
            $('#saved-records-delete-popup').popup('close');
           
        }, this));

    },

    /**
     * Show details of a single annotation.
     * @param evt Map Click event.
     */
    showRecordDetail: function(evt){
        var feature = this.getRecordsLayer().getFeatureFromEvent(evt);
        if(feature){
            var annotation = records.getSavedRecord(feature.attributes.id);

            this.createPopup(annotation);

            // give plugins a change to process the click first
            var showDetails = true;
            $.each(this.recordClickListeners, function(i, func){
                if(func(feature)){
                    showDetails = false;
                    return;
                }
            });

            if(showDetails){
                $('#map-record-popup').popup('open');
            }
        }
    },

    showRecordsForTrack: function(trackId)
    {

        var layer = this.getRecordsLayer();
        showAnnotationsForTrack(layer, trackId ) ;    
    },

    showTrackRecords: function()
    {
        var layer = this.getRecordsLayer();
        showTrackAnnotations(layer) ;
        layer.setVisibility(true);
        layer.refresh();
        
    },

    addAltTags: function()
    {
        var layer = this.getRecordsLayer();
        addAltTextToFeatureMarkers(layer.features) ;
    },
    
    
    /**
     * Display records on map.
     */
    showRecordsLayer: function(annotation){
        var layer = this.getRecordsLayer();
        if(layer.features.length === 0){
            showAnnotations(layer);
        }

        if(annotation){
            this.setCentre(annotation.record.point.lon,
                    annotation.record.point.lat,
                    undefined,
                    false);

            var track = _.find(annotation.record.fields, function (field) { return field.id.indexOf('track') > 0});
            // if a track, ignore as we don't want a popup
            if (track === undefined) {
                // Put in session storage so we can then pop up appropriate info on map page
                sessionStorage.setItem('annotationPopup', JSON.stringify(annotation));
            }

        }

        layer.setVisibility(true);
        layer.refresh();
    },

    /**
     * Switch base layers.
     * @param layer New base layer.
     */
    switchBaseLayer: function(layer){
        if(this.map.baseLayer !== null){
            if(layer.options.url === this.map.baseLayer.url){
                return;
            }

            this.map.removeLayer(this.map.baseLayer);
        }

        console.debug("switch base layer to " + layer.url);

        this.map.addLayer(layer);
        this.map.setBaseLayer(layer);

        this.postLocateZoomTo = POST_LOCATE_ZOOM_TO;

        // make sure switching to closed doesn't leave
        // the user at a zoom level that is not available
        if(this.map.getZoom() > POST_LOCATE_ZOOM_TO){
            this.map.setCenter(this.userLonLat, this.postLocateZoomTo);
        }
    },

    /**
     * TODO
     */
    toInternal: function(lonlat){
        var clone = lonlat.clone();
        clone.transform(
            EXTERNAL_PROJECTION,
            INTERNAL_PROJECTION);

        if(typeof(lonlat.gpsPosition) !== 'undefined'){
            clone.gpsPosition = lonlat.gpsPosition;
        }

        return clone;
    },

    /**
     * Reproject a mercator latlon to wgs84.
     * @param lonlat Mercator lonlat.
     * @return WGS84 lonlat
     */
    toExternal: function(lonlat){
        return lonlat.clone().transform(
            INTERNAL_PROJECTION,
            EXTERNAL_PROJECTION);
    },


    /**
     * Update annotate layer.
     * @param lonlat The position (in national grid) of the annotation icon, if
     * undefined use the centre of the map.
     */
    updateAnnotateLayer: function(lonlat){
        if(lonlat === undefined){
            lonlat = this.map.getCenter();
        }

        this.updateLayer(this.getAnnotateLayer(),
                         ANNOTATE_POSITION_ATTR,
                         undefined,
                         lonlat);
    },

    /**
     * Update a vector layer centred on users location.
     * @param layer The layer to update.
     * @id The id of the user icon feature.
     * @zoom The map zoom level to zoom to.
     * @lonLat The current location of the user.
     */
    updateLayer: function(layer, id, zoom, lonLat){
        var annotationFeature = layer.getFeaturesByAttribute('id', id);
        if(lonLat === undefined || lonLat === null){
            lonLat = this.toInternal(this.userLonLat);
        }

        var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);
        var v = new OpenLayers.Feature.Vector(point,
                                              {'id': id});

        if(lonLat.gpsPosition){
            point.gpsPosition = lonLat.gpsPosition;
        }

        if(annotationFeature.length === 0){
            annotationFeature = [v];
            layer.addFeatures(annotationFeature);
        }
        else {
            annotationFeature[0].move(lonLat);
        }
     
        annotationFeature[0].layer.div.setAttribute("alt", "location maker updated") ;
        annotationFeature[0].layer.div.setAttribute("aria-label", "location maker" + lonLat.lon + ", " + lonLat.lat) ;
        annotationFeature[0].layer.div.setAttribute("aria-live", "polite") ;
        annotationFeature[0].layer.div.setAttribute("role", "marquee") ;
        // utils.inform("current location updated", 1000 );       
        layer.setVisibility(true);
        layer.redraw();

        this.map.setCenter(lonLat, zoom);
    },

    /**
     * Update locate layer with users geo location.
     * optional zoom level for map
     */
    updateLocateLayer: function(zoom){
        if(!zoom){
            var zoom = this.map.getZoom();
            if(zoom < MIN_LOCATE_ZOOM_TO){
                zoom = POST_LOCATE_ZOOM_TO;
            }
        }

        this.updateLayer(this.getLocateLayer(), USER_POSITION_ATTR, zoom);
    },

    /**
     * Update map size after dynamic change in map size.
     */
    updateSize: function(){
        this.map.updateSize();
    },

    /**
     * Zoom map in one level.
     */
    zoomIn: function(){
        this.map.zoomIn();
    },

    /**
     * Zoom map out one level.
     */
    zoomOut: function(){
        this.map.zoomOut();
    },

    /**
     * TODO.
     */
    zoomToExtent: function(extent){
        this.map.zoomToExtent(extent);
    },

};

return _this;

});

