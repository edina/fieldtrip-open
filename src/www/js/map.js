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

/* global OpenLayers, L */

define(['records', 'utils', 'proj4js'], function(// jshint ignore:line
    records, utils, proj4js){
    var resolutions = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];

    var internalProjectionText = 'EPSG:900913';
    var externalProjectionText = 'EPSG:4326';

    var TMS_URL = "/mapcache/tms";
    var GPS_LOCATE_TIMEOUT = 3000;

    var tileMapCapabilities;
    var serviceVersion = "1.0.0"; // TODO needs parameterised

    var ANNOTATE_POSITION_ATTR = 'annotate_pos';
    var PADDLE_MARKER = 'paddle_marker';
    var USER_LOCATION = 'locate';
    var RECORDS_LAYER = 'records_layer';

    var defaultUserLon = -2.421976;
    var defaultUserLat = 53.825564;

    var mapSettings = utils.getMapSettings();
    var baseLayer;

    /**
     * Fetch TMS capabilities from server and store as this.tileMapCapabilities.
     */
    var fetchCapabilities = function(){
        //var map = _this.map;
        var baseLayerName;
        if(_this.map){
            baseLayerName = _this.map.getBaseLayerName();
            //baseLayer.layername;
        }

        var applyDefaults = $.proxy(function(){
            if(_this.isBaseLayerTMS()){
                _this.baseMapFullURL = _this.getTMSURL();
            }
            else{
                _this.baseMapFullURL = utils.getMapServerUrl();
            }
            tileMapCapabilities = {'tileSet': []};
            tileMapCapabilities.tileFormat = {
                'height': 256,
                'width': 256
            };
            tileMapCapabilities.tileSet = resolutions;
        }, this);

        if(baseLayerName){
            // fetch capabilities
            $.ajax({
                type: "GET",
                url: _this.baseMapFullURL,
                dataType: "xml",
                timeout: 10000,
                success: $.proxy(function(xml) {
                    var tileFormat = $(xml).find('TileFormat')[0];
                    if(tileFormat){
                        tileMapCapabilities.tileFormat = {
                            'height': $(tileFormat).attr('height'),
                            'width': $(tileFormat).attr('width')
                        };

                        $(xml).find('TileSet').each($.proxy(function(i, element){
                            // store units per pixel of each zoom level
                            tileMapCapabilities.tileSet[i] = $(element).attr('units-per-pixel');
                        }, this));
                    }
                    else{
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

var _base = {

    /**
     * Enable high accuracy flag.
     */
    GPS_ACCURACY_FLAG: true,

    /**
     * Resolution level to zoom to after user locate.
     */
    POST_LOCATE_ZOOM_TO: resolutions.length - 1,

    /**
     * Use position attribute name.
     */
    USER_POSITION_ATTR: 'user_pos',

    /**
     * Initialise base class.
     */
    init: function(){

    },

    /**
     * Finialise map.
     */
    postInit: function(){
        fetchCapabilities();
    },

    /**
     * Listen for
     */
    addRecordClickListener: function(callback){
        this.recordClickListeners.push(callback);
    },

    /**
     * @return layer with the draggable icon.
     */
    getAnnotateLayer: function(){
        return this.getLayer(PADDLE_MARKER);
    },

    /**
     * @return full URL of the map.
     */
    getBaseMapFullURL: function(){
        return this.baseMapFullURL+ serviceVersion + '/' + this.map.baseLayer.layername + '/';
    },

    /**
     * Get the current centre and zoom level of the map.
     * @param ext In extenal projection?
     * @returns:
     * {Object} Object with two properties: centre and zoom level.
     */
    getCentre: function(ext){
        var centre = this.map.getCenter();

        if(ext){
            centre = this.toExternal(centre);
        }

        return {
            centre: centre,
            zoom: this.getZoom()
        };
    },

    /**
     * @return Current map extent ({<OpenLayers.Bounds>}).
     */
    getExtent: function(){
        return this.map.getExtent();
    },

    /**
     * @return layer with the user icon.
     */
    getLocateLayer: function(){
        return this.getLayer(USER_LOCATION);
    },

    /**
     * @return map options
     */
    getOptions: function(){
        return this.map.options;
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
                        longitude: defaultUserLon,
                        latitude: defaultUserLat,
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
     * @return projections
     */
    getProjections: function(){
        return [this.internalProjection, this.externalProjection];
    },

    /**
     * @return Records vector layer.
     */
    getRecordsLayer: function(){
        return this.getLayer(RECORDS_LAYER);
    },

    /**
     * @return The map tileset capabilities object.
     */
    getTileMapCapabilities: function(){
        return tileMapCapabilities;
    },

    /**
     * @return Base stack type.
     */
    getStackType: function(){
        return this.getTileMapCapabilities().stack;
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
     * @return Zoom level details.
     */
    getZoomLevels: function(){
        return {
            current: this.map.getZoom(),
            max: this.map.getNumZoomLevels() - 1
        };
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
            this.onPositionSuccess(position, options.updateAnnotateLayer, true);
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
                        longitude: defaultUserLon,
                        latitude: defaultUserLat,
                        heading: 130,
                        altitude: 150
                    }
                };

                this.onPositionSuccess(pos,
                                       options.updateAnnotateLayer,
                                       false);
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
     * Timeout duration for geo location.
     */
    geolocateTimeout: GPS_LOCATE_TIMEOUT,

    /**
     * Hide annotation layer.
     */
    hideAnnotateLayer: function(){
        this.hideLayer(this.getAnnotateLayer());
    },

    /**
     * Remove all annotations / records from map.
     */
    hideRecordsLayer: function(){
        this.getRecordsLayer().setVisibility(false);

        $.each(this.map.layers, function(i, layer){
            // TODO - what does the map know about GPS Tracks?

            // GPS tracks are on a seperate layer beginning with 'gps-track-'
            if(layer.name.substr(0, 10) === 'gps-track-'){
                layer.setVisibility(false);
            }
        });
    },

    /**
     * @return Is the records layer visible
     */
    isRecordsLayerVisible: function(){
        return this.isLayerVisible(this.getRecordsLayer());
    },

    /**
     * Receive a new user position.
     * @param position The GPS position http://docs.phonegap.com/en/2.1.0/cordova_geolocation_geolocation.md.html#Position.
     * @param updateAnnotateLayer Should annotate layer be updated after position
     * success?
     * @param hideLoadingDialog Hide loading dialog after success
     */
    onPositionSuccess: function(position,
                                updateAnnotateLayer,
                                hideLoadingDialog){
        this.updateUserPosition(position.coords.longitude,
                                position.coords.latitude);
        this.userLonLat.gpsPosition = position.coords;

        if(position.coords.heading){
            if(this.getAnnotateLayer().features.length > 0){
                // set rotation to heading direction, doesn't work on most android
                // devices, see http://devel.edina.ac.uk:7775/issues/4852
                this.getAnnotateLayer().features[0].attributes.imageRotation =
                    360 - position.coords.heading;
            }
        }

        // update user position
        this.updateLocateLayer();

        // if necessary update annotate pin
        if(updateAnnotateLayer){
            this.updateAnnotateLayer(this.toInternal(this.userLonLat));
        }

        if(hideLoadingDialog){
            $.mobile.hidePageLoadingMsg();
        }
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
     * Set centre of the map with a comma separated lon lat string
     * @params lonLatStr The point to centre on as a comma seperated string
     * @zoom The new zoom level
     * @external Is the point in external projection?
     */
    setCentreStr: function(lonLatStr, zoom, external){
        var lonLat = lonLatStr.split(',');
        this.setCentre({
            lon: lonLat[0],
            lat: lonLat[1],
            zoom: zoom,
            external: external
        });
    },

    /**
     * Set users default location.
     * @param point in internal projection.
     */
    setDefaultLocation: function(point){
        var extLonLat = this.toExternal(point);
        this.setDefaultLonLat(extLonLat.lon, extLonLat.lat);
    },

    /**
     * Override default lon lat values.
     * @param lon Longitude in external projection.
     * @param lat Latitude in extenal projection.
     */
    setDefaultLonLat: function(lon, lat){
        defaultUserLon = lon;
        defaultUserLat = lat;
    },

    /**
     * Show annotation marker.
     */
    showAnnotateLayer: function(){
        this.getAnnotateLayer().setVisibility(true);
    },

    /**
     * Show user's position.
     */
    showLocateLayer: function(){
        //this.getLocateLayer().setVisibility(true);
        this.showLayer(this.getLocateLayer());
    },

    /**
     * Show details of a single annotation.
     * @param evt Map Click event.
     */
    showRecordDetail: function(evt){
        var feature = this.getRecordsLayer().getFeatureFromEvent(evt);
        if(feature){
            var annotation = records.getSavedRecord(feature.attributes.id);

            this.showRecordDetailPopup(annotation);

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

    /**
     * Populates an annotation popup with details of the passed annotation
     * Note that you still have to pop it up manually after this step
     * @param annotation
     */
    showRecordDetailPopup: function(annotation) {
        // Get point and convert
        var point =  this.toExternal(this.map.center);
        var lon = point.lon;
        var lat = point.lat;

        var popup =  $('#map-record-popup');

        popup.off('popupbeforeposition');
        popup.on({
            popupbeforeposition: function() {
                var showRecord = function(html){
                    var coords = '<p id="coords"><span> Coordinates</span>: (' + lon + ', '+ lat +')</p>';
                    $('#map-record-popup-text').append(html).append(coords).trigger('create');
                };

                $('#map-record-popup h3').text(annotation.record.name);
                $('#map-record-popup-text').text('');

                $.each(annotation.record.fields, function(i, entry){
                    var html;
                    var type = records.typeFromId(entry.id);

                    if(type === 'image'){
                        html = '<img src="' + entry.val + '" width=100%"/>';
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
        popup.off('vclick');
        popup.on('vclick',  function() {
            popup.popup('close');
        });
    },

    /**
     * Display records on map.
     */
    showRecordsLayer: function(annotation){
        var layer = this.getRecordsLayer();
        if(layer.features.length === 0){
            var features = [];
            $.each(records.getSavedRecords(), $.proxy(function(id, annotation){
                var record = annotation.record;
                if(record.point !== undefined){
                    features.push(this.createMarker(id, annotation));
                }
                else{
                    console.debug("record " + id + " has no location");
                }
            }, this));

            this.addMarkers(layer, features);
        }

        if(annotation){
            this.setCentre({
                lon: annotation.record.point.lon,
                lat: annotation.record.point.lat,
                zoom: undefined,
                external: false
            });
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

        // make sure switching to closed doesn't leave
        // the user at a zoom level that is not available
        if(this.getZoom() > this.POST_LOCATE_ZOOM_TO){
            this.map.setCenter(this.userLonLat, this.POST_LOCATE_ZOOM_TO);
        }
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

        this.updateLayer({
            layer: this.getAnnotateLayer(),
            id: ANNOTATE_POSITION_ATTR,
            zoom: undefined,
            lonLat: lonlat
        });
    },

    /**
     * Update locate layer with users geo location.
     */
    updateLocateLayer: function(){
        var zoom = this.getZoom();
        if(zoom < this.minLocateZoomTo){
            zoom = this.POST_LOCATE_ZOOM_TO;
        }

        this.updateLayer({
            layer: this.getLocateLayer(),
            id: this.USER_POSITION_ATTR,
            zoom: zoom
        });
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
     * Zoom map to the given extents.
     * @param extent An openlayers bounding box.
     */
    zoomToExtent: function(extent){
        this.map.zoomToExtent(extent);
    },

};

var _openlayers = {

    /**
     * Set up openlayers map.
     */
    init: function(){
        this.minLocateZoomTo = resolutions.length - 3;
        var bounds = new OpenLayers.Bounds (0,0,700000,1300000);

        if(mapSettings.baseLayer === 'osm'){
            baseLayer = new OpenLayers.Layer.OSM();
            bounds = new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508.34);
            resolutions = [156543.03390625,
                           78271.516953125,
                           39135.7584765625,
                           19567.87923828125,
                           9783.939619140625,
                           4891.9698095703125,
                           2445.9849047851562,
                           1222.9924523925781,
                           611.4962261962891,
                           305.74811309814453,
                           152.87405654907226,
                           76.43702827453613,
                           38.218514137268066,
                           19.109257068634033,
                           9.554628534317017,
                           4.777314267158508,
                           2.388657133579254,
                           1.194328566789627,
                           0.5971642833948135,
                           0.25,
                           0.1,
                           0.05];
        }
        else{
            var proj = mapSettings.epsg;
            proj4js.defs[proj] = mapSettings.proj;
            internalProjectionText = proj;
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

        this.internalProjection = new OpenLayers.Projection(internalProjectionText);
        this.externalProjection = new OpenLayers.Projection(externalProjectionText);

        this.recordClickListeners = [];
        var options = {
            controls: [],
            projection: this.internalProjection,
            displayProjection: this.externalProjection,
            units: 'm',
            resolutions: resolutions,
            maxExtent: bounds,
            theme: null,
        };

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
            RECORDS_LAYER,
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
            PADDLE_MARKER,
            {
                style: positionMarkerStyle,
                visibility: false
            }
        );

        // user location layer
        var locateLayerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        locateLayerStyle.externalGraphic = "css/images/user.png";
        locateLayerStyle.graphicWidth = 20;
        locateLayerStyle.graphicHeight = 20;
        locateLayerStyle.graphicOpacity = 1;
        locateLayerStyle.rotation = "${imageRotation}";
        var locateLayer = new OpenLayers.Layer.Vector(
            USER_LOCATION,
            {
                style: locateLayerStyle,
                renderers: ["Canvas"]
            }
        );

        // add layers to map
        this.map.addLayers([positionMarkerLayer,
                            recordsLayer,
                            locateLayer]);

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
            defaultUserLon,
            defaultUserLat);
        this.userLonLat.gpsPosition = {
            longitude: defaultUserLon,
            latitude: defaultUserLat,
            heading: 130,
            altitude: 150
        };

        var drag = new OpenLayers.Control.DragFeature(positionMarkerLayer);
        this.map.addControl(drag);
        drag.activate();

        this.setCentre({
            lon: defaultUserLon,
            lat: defaultUserLat,
            zoom: this.minLocateZoomTo,
            external: true
        });
    },

    /**
     * Add a GPX layer to the map.
     * @param options
     *   id - layer id
     *   style - some styles
     *   url - location of the GPX file.
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
                projection: this.externalProjection
            }
        );

        this.map.addLayer(layer);
        return layer;
    },

    /**
     * Add a new layer to the map.
     * @param options
     *   id - layer id
     *   style - some styles
     *   visible - intitial visibility
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
     * Add miscellaneous layer on the map
     * @param layer to add.
     */
    addMapLayer: function(layer){
        this.map.addLayer(layer);
    },

    /**
     * Add multiple markers to the map.
     * @param layer The layers to add the markers to.
     * @param markers An array of markers.
     */
    addMarkers: function(layer, markers){
        layer.addFeatures(markers);
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
     * Add MBTiles layer
     * @param options
     *   name - name of the layer that is added on the map
     *   url  - the url of the mbtiles server
     *   db   -the name of the db
     */
    addRemoteMBTilesLayer: function(options){
        var mbtilesLayer = new OpenLayers.Layer.TMS(options.name, options.url, {
            getURL: function mbtilesURL (bounds) {
                var res = this.map.getResolution();
                var x = Math.round ((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
                var y = Math.round ((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
                var z = this.getZoom();
                // Deal with Bing layers zoom difference...
                if (this.map.baseLayer.CLASS_NAME == 'OpenLayers.Layer.VirtualEarth' || this.map.baseLayer.CLASS_NAME == 'OpenLayers.Layer.Bing') {
                    z = z + 1;
                }
                return this.url+"?db="+options.db+"&z="+z+"&x="+x+"&y="+((1 << z) - y - 1);
            },
            isBaseLayer: false,
            opacity: 0.7
        });
        // See: http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection

        this.map.addLayer(mbtilesLayer);
    },

    /**
     * Does the layer exists on map?
     * @param name of the layer
     * @return true, false
     */
    checkIfLayerExists: function(name){
        return (this.map.getLayersByName(name).length > 0);
    },

    /**
     * Create a marker for a given FT annotation.
     * @param id Annotation id
     * @param annotation FT annotation object.
     * @return OpenLayers.Feature.Vector
     */
    createMarker: function(id, annotation){
        return new OpenLayers.Feature.Vector(
            new OpenLayers.Geometry.Point(
                annotation.record.point.lon,
                annotation.record.point.lat),
            {
                'id': id,
                'type': records.getEditorId(annotation)
            }
        );
    },

    /**
     * Render the map on a defined div.
     * @param div The div id.
     */
    display: function(div){
        this.map.render(div);
    },

    /**
     * Get current annotation coords (the paddle location).
     * @param ext In external projection? If not internal.
     * @return Current annotation coordinates.
     */
    getAnnotationCoords: function(ext){
        var coords;
        var features = this.getAnnotateLayer().getFeaturesByAttribute(
            'id',
            ANNOTATE_POSITION_ATTR);

        if(features.length > 0){
            var geom = features[0].geometry;
            coords = new OpenLayers.LonLat(geom.x, geom.y);
            if(ext){
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
     * @return The coordinates of the user, in external projection, based on the
     * position of the user icon. ({<OpenLayers.LonLat>}).
     */
    getLocateCoords: function(){
        var geom = this.getLocateLayer().getFeaturesByAttribute(
            'id', this.USER_POSITION_ATTR)[0].geometry;

        return this.toExternal(new OpenLayers.LonLat(geom.x, geom.y));
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
     * @return current map zoom level.
     */
    getZoom: function(){
        return this.map.getZoom();
    },

    /**
     * Hide map layer.
     * @param layer - the layer to hide.
     */
    hideLayer: function(layer){
        layer.setVisibility(false);
    },

    /**
     * check if the base layer is TMS or not
     */
    isBaseLayerTMS: function(){
        return this.getBaseLayer() instanceof OpenLayers.Layer.TMS;
    },

    /**
     * @param The map layer.
     * @return Is the layer currently visible?
     */
    isLayerVisible: function(layer){
        return layer.visibility;
    },

    /**
     * Covert a point object to external projection.
     * @param point A point object with internal projection.
     * @return A point object reprojected to external projection.
     */
    pointToExternal: function(point){
        var lonLat = this.toExternal(new OpenLayers.LonLat(point.lon, point.lat));
        return {
            'lon': lonLat.lon,
            'lat': lonLat.lat
        };
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
     * Register an object and function to receive map zoom change updates.
     * @param obj
     * @param callback
     */
    registerZoom: function(obj, callback){
        this.map.events.register('zoomend', obj, callback);
    },

    /**
     * Remove all features from a layer.
     * @param layer An openlayers layer.
     */
    removeAllFeatures: function(layer){
        layer.removeAllFeatures();
    },

    /**
     * Remove layer from map.
     * @param layer An openlayers layer.
     */
    removeLayer: function(layer){
        this.map.removeLayer(layer);
    },

    /**
     * Centre map with zoom level.
     * options:
     *   lon
     *   lat
     *   zoom
     *   external - use external projection.
     */
    setCentre: function(options){
        var lonlat;
        if(options.external){
            lonlat = this.toInternal(new OpenLayers.LonLat(options.lon, options.lat));
        }
        else{
            lonlat = new OpenLayers.LonLat(options.lon, options.lat);
        }

        var zoom = options.zoom;
        if(!zoom){
            zoom = this.getZoom();
        }

        this.map.setCenter(lonlat, zoom);
    },

    /**
     * Display all annotations on speficied layer.
     * @param layer The layer to use.
     */
    // var showAnnotations = function(layer){
    //     var features = [];

    //     //Utils.printObj(records.getSavedrecords());

    //     $.each(records.getSavedRecords(), function(id, annotation){
    //         var record = annotation.record;
    //         if(record.point !== undefined){
    //             features.push(new OpenLayers.Feature.Vector(
    //                 new OpenLayers.Geometry.Point(record.point.lon,
    //                                               record.point.lat),
    //                 {
    //                     'id': id,
    //                     'type': records.getEditorId(annotation)
    //                 }
    //             ));
    //         }
    //         else{
    //             console.debug("record " + id + " has no location");
    //         }
    //     });

    //     layer.addFeatures(features);
    // };

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

        this.setCentre({
            lon: poi.centre.lon,
            lat: poi.centre.lat,
            zoom: poi.zoom
        });
        this.map.zoomTo(this.getZoom() - 2);
    },

    /**
     * Show layer on map.
     * @param layer
     */
    showLayer: function(layer){
        layer.setVisibility(true);
    },

    /**
     * Reproject external point to internal lonlat.
     * @param External lonlat.
     * @return Cloned internal lonlat.
     */
    toInternal: function(lonlat){
        var clone = lonlat.clone();
        clone.transform(
            this.externalProjection,
            this.internalProjection);

        if(typeof(lonlat.gpsPosition) !== 'undefined'){
            clone.gpsPosition = lonlat.gpsPosition;
        }

        return clone;
    },

    /**
     * Reproject internal point to internal lonlat.
     * @param Internal lonlat.
     * @return Cloned external lonlat
     */
    toExternal: function(lonlat){
        return lonlat.clone().transform(
            this.internalProjection,
            this.externalProjection);
    },

    /**
     * Update a vector layer centred on users location.
     * options:
     *   layer: The layer to update.
     *   id: The id of the user icon feature.
     *   zoom: The map zoom level to zoom to.
     *   lonLat: The current location of the user.
     */
    updateLayer: function(options){
        var id = options.id;
        var layer = options.layer;
        var annotationFeature = layer.getFeaturesByAttribute('id', id);
        var lonLat = options.lonLat;
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

        layer.setVisibility(true);
        layer.redraw();

        this.map.setCenter(lonLat, options.zoom);
    },

    /**
     * Update user position.
     * @param lon
     * @param lat
     */
    updateUserPosition: function(lon, lat){
        this.userLonLat = new OpenLayers.LonLat(lon, lat);
    }
};

var _this = {};
var _leaflet = {

    /**
     * Set up openlayer map.
     */
    init: function(){
        //_base.init();
        this.MAX_ZOOM = 18;
        this.minLocateZoomTo = this.MAX_ZOOM - 3;
    },

    /**
     * Add a GPX layer to the map.
     * @param options
     *   id - layer id
     *   style - some styles
     *   url - location of the GPX file.
     */
    addGPXLayer: function(options){

    },

    /**
     * Add a new layer to the map.
     * @param options
     *   id - layer id
     *   style - some styles
     *   visible - intitial visibility
     */
    addLayer: function(options){

    },

    /**
     * Add multiple markers to the map.
     * @param layer The layers to add the markers to.
     * @param markers An array of markers.
     */
    addMarkers: function(layer){

    },

    /**
     * Add miscellaneous layer on the map
     * @param layer to add.
     */
    addMapLayer: function(layer){

    },

    /**
     * Add a new style record icons.
     * @param options
     *   type - the record type
     *   image - path to record image
     */
    addRecordStyle: function(options){

    },

    /**
     * Create a marker for a given FT annotation.
     * @param id Annotation id
     * @param annotation FT annotation object.
     */
    createMarker: function(id, annotation){

    },

    /**
     * Render the map on a defined div.
     * @param div The div id.
     */
    display: function(div){
        this.map = L.map('map');
        var centre = [defaultUserLat, defaultUserLon];
        if(this.userLonLat){
            centre = [this.userLonLat.lat, this.userLonLat.lng];
        }
        this.map.setView(centre, this.minLocateZoomTo);
        L.tileLayer('http://{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpg', {
            subdomains: ['otile1', 'otile2', 'otile3', 'otile4'],
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
            maxZoom: this.MAX_ZOOM
        }).addTo(this.map);

        // this.map = L.map('map', { zoomControl:false }).setView([55.6, -3.5], 13).setZoom(7);
        // L.Icon.Default.imagePath = 'images';
        // new L.Control.Zoom({ position: 'topright' }).addTo(this.map);
        // L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpg', {
        //     attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        //     maxZoom: 18}).addTo(this.map);
    },

    /**
     * Get current annotation coords (the paddle location).
     * @param ext In external projection? If not internal.
     * @return Current annotation coordinates.
     */
    getAnnotationCoords: function(ext){

    },

    /**
     * @return leaflet base layer.
     */
    getBaseLayer: function(){

    },

    /**
     * @return The coordinates of the user, in external projection, based on the
     * position of the user icon.
     */
    getLocateCoords: function(){

    },

    /**
     * @param layerName
     * @return Leaflet layer by name.
     */
    getLayer: function(layerName){
        return {
            features: []
        };
    },

    /**
     * @return current map zoom level.
     */
    getZoom: function(){
        return 2;
    },

    /**
     * Hide map layer.
     * @param layer The layer to hide.
     */
    hideLayer: function(layer){

    },

    /**
     * @return Is the base layer map a TMS?
     */
    isBaseLayerTMS: function(){
        return true;
    },

    /**
     * @param The map layer.
     * @return Is the layer currently visible?
     */
    isLayerVisible: function(layer){
        return false;
    },

    /**
     * Covert a point object to external projection.
     * @param point A point object with internal projection.
     * @return A point object reprojected to external projection.
     */
    pointToExternal: function(point){

    },

    /**
     * Covert a point object to internal projection.
     * @param point A point object with external projection.
     * @return A point object reprojected to internal projection.
     */
    pointToInternal: function(point){

    },

    /**
     * Centre map with zoom level.
     * options:
     *   lon
     *   lat
     *   zoom
     *   external - use external projection.
     */
    setCentre: function(options){

    },

    /**
     * Show layer on map.
     * @param layer
     */
    showLayer: function(layer){
        //this.getLocateLayer().setVisibility(true);
    },

    /**
     * Reproject external point to internal.
     * @param External point.
     * @return Cloned internal point.
     */
    toInternal: function(point){

    },

    /**
     * Reproject internal point to internal.
     * @param Internal point.
     * @return Cloned external point.
     */
    toExternal: function(point){

    },

    /**
     * Update a vector layer centred on users location.
     * options:
     *   layer: The layer to update.
     *   id: The id of the user icon feature.
     *   zoom: The map zoom level to zoom to.
     *   lonLat: The current location of the user.
     */
    updateLayer: function(options){

    },

    /**
     * Update user position.
     * @param lon
     * @param lat
     */
    updateUserPosition: function(lon, lat){
        this.userLonLat = L.latLng(lat, lon);
    }
};

if(utils.getMapLib() === 'leaflet'){
    require(['ext/leaflet'], function(){});
    $('head').prepend('<link rel="stylesheet" href="css/ext/leaflet.css" type="text/css" />');
    $.extend(_this, _base, _leaflet);
}
else{
    require(['ext/openlayers'], function(){});
    $.extend(_this, _base, _openlayers);
}


return _this;

});
