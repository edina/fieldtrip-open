/*
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
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

/* global OpenLayers, L, Proj4js */

define(function(require) {
    // Import modules
    var records = require('records');
    var utils = require('utils');
    var proj4 = require('proj4');
    var _ = require('underscore');

    // default resolutions and bounds
    var resolutions = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
    var BOUNDS = [0, 0, 700000, 1310720];

    var internalProjectionText = 'EPSG:900913';
    var externalProjectionText = 'EPSG:4326';

    var TMS_URL = "/mapcache/tms";
    var GPS_LOCATE_TIMEOUT = 30000;
    var GPS_LOCATE_TTL = 0;

    var tileMapCapabilities;
    var serviceVersion = "1.0.0"; // TODO needs parameterised

    var ANNOTATE_POSITION_ATTR = 'annotate_pos';
    var PADDLE_RECORD = 'paddle_record';
    var USER_LOCATION = 'locate';
    var RECORDS_LAYER = 'records_layer';

    var defaultUserLon = -2.421976;
    var defaultUserLat = 53.825564;
    var defaultUserHeading = 130;
    var defaultUserAltitude = 150;

    var mapSettings = utils.getMapSettings();
    var baseLayer;
    var events = [];

    //change the default locations according to locale if exists
    if(navigator.globalization) {
        navigator.globalization.getLocaleName(
            function (locale) {
                console.debug('locale: ' + locale.value);
                var locations = utils.getDefaultLocations();
                for(var key in locations){
                    if(key === locale.value){
                        defaultUserLon = locations[key].lon;
                        defaultUserLat = locations[key].lat;
                        break;
                    }
                }
            },
            function () {
                console.error('Error getting locale\n');
            }
        );
    }

    /**
     * Fetch TMS capabilities from server and store as this.tileMapCapabilities.
     */
    var fetchCapabilities = function(){
        var baseLayerName;
        if(_this.map){
            baseLayerName = _this.getBaseLayerName();
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
     * GPS time out
     */
    EVT_GPS_TIMEOUT: 'evt-gps-timeout',

    /**
     * Hide records on map event name.
     */
    EVT_HIDE_RECORDS: 'evt-hide-records',

    /**
     * Before exit event
     */
    EVT_BEFORE_EXIT: 'evt-before-exit',

    /**
     * Enable high accuracy flag.
     */
    GPS_ACCURACY_FLAG: true,

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
     *   Publish/Suscribe functions for the map
     */

    /**
     *  Suscribe to a event
     *  @param e event name
     *  @param callback the function to be executed
    */
    on: function(e, callback){
        var event = events[e];
        if(!event){
            event = $.Callbacks();
            events[e] = event;
        }
        event.add(event, callback);
    },

    /**
      *  Remove all the callback for an event
      *  @param e event name
    */
    off: function(e){
        var event = events[e];
        if(event){
            event.remove(event);
        }
    },

    /**
      *  Trigger an event
      *  @param e event name
    */
    trigger: function(e){
        var event = events[e];
        if(event){
            event.fire.apply(this, arguments);
        }
    },

    /**
     * Listen for
     */
    addRecordClickListener: function(callback){
        this.recordClickListeners.push(callback);
    },

    /**
     * Add a layer to the list of layers tracket in local storage
     * @param layerId {String} an unique identifier for the layer UUID preferred
     * @param layerName {String} a name for the layer that will be used in the layers list
     * @param layerType {String} the type ie. the plugin that added the layer
     * @param options {Object} any extra option used to process the layer
     */
    addLayerToLayersList: function(layerId, layerName, layerType, options) {
        var addLayer = function(layers) {
            if (layers === null) {
                layers = {};
            }

            layers[layerId] = {
                id: layerId,
                name: layerName,
                type: layerType,
                options: options
            };

            return layers;
        };

        records.usingLocalStorage('layers')(addLayer);
    },

    /**
     * Extract the coordinate reference system text from a geoJSON
     * @param geoJSON a geoJSON
     * @returns the crs as text
     */
    crsTextFromGeoJSON: function(geoJSON) {
        var defaulGeoJSONProj = 'EPSG:4326';
        var crsText = null;

        if (typeof geoJSON !== 'object') {
            console.warn('Invalid geoJSON Object');
            return null;
        }

        // Use default GeoJSON projection
        if (typeof geoJSON.crs !== 'object') {
            return defaulGeoJSONProj;
        }

        if (geoJSON.type === 'name') {
            if (geoJSON.properties && geoJSON.properties.name) {
                crsText = geoJSON.properties.name;
            }
        }
        else {
            console.debug('Read crs from <' + geoJSON.type + '> not implemented');
        }

        return crsText;
    },

    /**
     * clear watch if already defined
     */
    clearGeoLocateWatch: function(){
        if(this.geoLocationWatchID !== undefined){
            navigator.geolocation.clearWatch(this.geoLocationWatchID);
        }
    },

    /**
     * Initialize the side panel in the map page
     */
    initLayersPanel: function() {
        $('#layers-panel').panel();
        this.populateLayersPanel();
    },

    /**
     * Reads the list of layers from local storage, creates the html markup
     * and attaches the handlers
     */
    populateLayersPanel: function() {
        var _this = this;
        var populatePanel = function(layers) {
            var html;
            var i = 0;
            var $layersList = $('#layers-list');
            var itemTemplate = _.template(
                '<li data-layerid="<%= layerId %>">' +
                    '<label for="flip-checkbox-<%=index%>>">' +
                        '<%=layerName%>' +
                    '</label>' +
                    '<input data-role="flipswitch"' +
                            'name="flip-checkbox-<%=index%>' +
                            'id="flip-checkbox-<%=index%>' +
                            'class="show-layer" <%=checked%> type="checkbox">' +
                '</li>'
            );

            if (layers === null) {
                return;
            }

            $layersList.append('<ul>');
            _(layers).forEach(function(layer) {
                var $item;
                var itemHtml;
                var checked = '';
                var mapLayer = _this.getLayer(layer.id);
                if (mapLayer !== undefined && _this.isLayerVisible(mapLayer)) {
                    checked = 'checked';
                }

                itemHtml = itemTemplate({
                    layerId: layer.id,
                    layerName: layer.name,
                    index: i,
                    checked: checked
                });

                $(itemHtml)
                    .appendTo($layersList)
                    .on('change', 'input', function(event) {
                        var $target = $(event.target);
                        if ($target.is(':checked')) {
                            $target.trigger('enableLayer', [layer]);
                        }
                        else {
                            $target.trigger('disableLayer', [layer]);
                        }
                    })
                    .on('vclick', 'label', function(event) {
                        var $target = $(event.target);
                        $target.trigger('clickLayer', [layer]);
                    });
                i++;
            });
            $layersList.append('</ul>');

            $layersList.trigger('create');
        };

        records.usingLocalStorage('layers')(populatePanel);
    },

    /**
     * Suscribe to the controls placed in the layers list panel
     * @param handlers {Object}
     *     - enableLayer {function} triggered when the flipswitch is turned on
     *     - disableLayer {function} triggered when the flipswitch is turned off
     *     - clickLayer {function} triggered when the label is tapped
     */
    suscribeToLayersControl: function(handlers) {
        $(document).on('enableLayer', '#layers-list > li', handlers.enableLayer);
        $(document).on('disableLayer', '#layers-list > li', handlers.disableLayer);
        $(document).on('clickLayer', '#layers-list > li', handlers.clickLayer);
    },

    /**
     * @return layer with the draggable icon.
     */
    getAnnotateLayer: function(){
        return this.getLayer(PADDLE_RECORD);
    },

    /**
     * @return layer with the user icon.
     */
    getBaseLayerName: function(){
        return this.getLayerName(this.getBaseLayer());
    },

    /**
     * @return full URL of the map.
     */
    getBaseMapFullURL: function(){
        return this.baseMapFullURL + serviceVersion + '/' + this.map.baseLayer.layername + '/';
    },

    /**
     * Get the current centre and zoom level of the map.
     * @param ext In extenal projection?
     * @returns map centre object.
     */
    getCentre: function(ext){
        var centre = this.map.getCenter();

        if(ext){
            centre = this.toExternal(centre);
        }

        return centre;
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
     * Get the object of registered layers in localstorage
     * @returns {Object} of layers
     */
    getLayersFromLayerList: function() {
        var _layers;

        records.usingLocalStorage('layers')(function(layers) {
            if (layers === null) {
              layers = {};
            }

            _layers = layers;

            return layers;
        });

        return _layers;
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
                        heading: defaultUserHeading,
                        altitude: defaultUserAltitude
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
     * @return The tile file type of the base layer.
     */
    getTileFileType: function(){
        return this.getBaseLayer().type || 'png';
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
    getUserCoords: function(){
        return this.toInternal(this.userLonLat);
    },

    /**
     * @return The coordinates of the user, based on the last geolocate, in
     * external projection.
     * ({<OpenLayers.LonLat>})
     */
    getUserCoordsExternal: function(){
        return this.userLonLat;
    },

    /**
     * @return Zoom level details.
     *   current - current map level
     *   max - maximum available zoom level
     */
    getZoomLevels: function(){
        return {
            current: this.map.getZoom(),
            max: this.map.getNumZoomLevels() - 1
        };
    },

    /**
     * Locate user on map.
     * @param secretly If true do not show page loading msg.
     * @param updateAnnotateLayer Should annotate layer be informed of new position?
     * @param useDefault If no user location found should default be used?
     * @param timeout miliseconds before throwing a timeoout error
     * @param ttl How many seconds a cached location is valid (this parameter is ignored if watch is true)
     * @param watch if true a watch will be created and any previous watch will be cleared
     * @param autocentre centre the map to the user location?
     */
    geoLocate: function(options){
        console.debug("Geolocate user: secretly: " + options.secretly +
                      ". updateAnnotateLayer: " + options.updateAnnotateLayer +
                      ". useDefault: " + options.useDefault +
                      ". timeout: " + options.timeout +
                      ". ttl: " + options.ttl +
                      ". watch: " + options.watch +
                      ". autocentre: " + options.autocentre);

        options.timeout =  options.timeout || this.geolocateTimeout;
        options.ttl =  options.ttl || this.geolocateTTL;

        if(!options.secretly){
            $.mobile.loading('show', {
                text: 'Waiting for GPS fix',
                textonly: true,
            });
        }

        // found user location
        var onSuccess = $.proxy(function(position){
            console.debug("Position found: "+ position.coords.latitude + "," + position.coords.longitude);

            _this.onPositionSuccess(position, {
                updateAnnotateLayer: options.updateAnnotateLayer,
                hideLoadingDialog: true,
                autocentre: options.autocentre,
                autopan: options.autopan
            });
            $.mobile.loading('hide');
        }, this);

        // problem with geo locate
        var onError = $.proxy(function(error){
            if(error.code === 3){
                // timeout
                console.debug("GPS timed out: " + error.code);
                if(!options.secretly){
                    utils.inform('GPS timed out');
                }
                // fire edit record event, this allows plugins to edit record
                $.event.trigger(
                    {
                        type: this.EVT_GPS_TIMEOUT,
                    }
                );
            }
            else{
                console.debug("GPS is not enabled");
                if(!options.secretly){
                    utils.inform('Your GPS needs to be enabled.', 5000);
                }
            }

            var lon, lat;
            if(options.useDefault){
                //  just go to center of UK
                lon = defaultUserLon;
                lat = defaultUserLat;
            }
            else{
                // or the centre of the map
                var centre = this.getCentre(true);
                lon = centre.lon;
                lat = centre.lat;
            }
            var pos = {
                coords: {
                    longitude: lon,
                    latitude: lat,
                    heading: defaultUserHeading,
                    altitude: defaultUserAltitude,
                    accuracy: null
                }
            };

            this.onPositionSuccess(pos, {
                updateAnnotateLayer: options.updateAnnotateLayer,
                hideLoadingDialog: false,
                autocenter: options.autocenter
            });
        }, this);

        if(options.watch){
            this.clearGeoLocateWatch();
            this.geoLocationWatchID = navigator.geolocation.watchPosition(
                onSuccess,
                onError,
                {
                    enableHighAccuracy: this.GPS_ACCURACY_FLAG,
                    timeout: options.timeout
                }
            );
        }
        else{
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                onError,
                {
                    enableHighAccuracy: this.GPS_ACCURACY_FLAG,
                    maximumAge: options.ttl,
                    timeout: options.timeout
                }
            );
        }
    },

    /**
     * Timeout duration for geo location.
     */
    geolocateTimeout: GPS_LOCATE_TIMEOUT,

    /**
     * Time which a cached feature is valid
     */
    geolocateTTL: GPS_LOCATE_TTL,


    /**
     * @return current map zoom level.
     */
    getZoom: function(){
        if(this.map){
            return this.map.getZoom();
        }
        else{
            return -1;
        }
    },

    /**
     * Hide annotation layer.
     */
    hideAnnotateLayer: function(){
        this.hideLayer(this.getAnnotateLayer());
        this.toolbar.deactivate();
    },

    /**
     * Remove all annotations / records from map.
     */
    hideRecordsLayer: function(){
        this.hideLayer(this.getRecordsLayer());

        // fire hide records event
        $.event.trigger({
            type: this.EVT_HIDE_RECORDS,
        });
    },

    /**
     * @return Is the records layer visible
     */
    isRecordsLayerVisible: function(){
        return this.isLayerVisible(this.getRecordsLayer());
    },

    /**
      * Start compass and use it to rotate the location marker
      */
    startCompass: function(){
        var self = this;
        if(navigator.compass !== undefined){
            var onSuccess = function(heading){
                // Make sure that there is a running compass watch
                if(self.compassWatchID === null){
                    console.debug('Ignoring compass update with null watch');
                }else{
                    _this.rotateLocationMarker(heading.magneticHeading);
                }
            };
            var onError = function(error){
                console.debug('error: ' + error);
            };

            var options = {frequency: 500};

            this.stopCompass(this.compassWatchID);
            this.compassWatchID = navigator.compass.watchHeading(onSuccess,
                                                                 onError,
                                                                 options);
        }
    },

    /**
     * @return Is the base layer Open Street Map?
     */
    isOSM: function(){
        return mapSettings.baseLayer === 'osm';
    },

    /**
     * Receive a new user position.
     * @param position The GPS position http://docs.phonegap.com/en/2.1.0/cordova_geolocation_geolocation.md.html#Position.
     * @param options.updateAnnotateLayer Should annotate layer be updated after position
     * success?
     * @param options.hideLoadingDialog Hide loading dialog after success
     * @param options.autocentre autocentre the map to the user location?
     */
    onPositionSuccess: function(position, options){
        this.updateUserPosition(position.coords.longitude,
                                position.coords.latitude);
        this.userLonLat.gpsPosition = position.coords;
        this.userLonLat.markerMoved = false;
        console.debug('Accuracy: '          + position.coords.accuracy        );
        console.debug('Altitude Accuracy: ' + position.coords.altitudeAccuracy);
        console.debug('Heading: '           + position.coords.heading         );
        console.debug('Speed: '             + position.coords.speed           );
        console.debug('Timestamp: '         + position.timestamp              );

        // update user position
        this.updateLocateLayer({
                                 autocentre: options.autocentre,
                                 autopan: options.autopan,
                                 zoom: false
                               });

        // if necessary update annotate pin
        if(options.updateAnnotateLayer){
            this.updateAnnotateLayer(this.toInternal(this.userLonLat));
        }

        if(options.hideLoadingDialog){
            $.mobile.loading('hide');
        }
    },

    /**
     * Sledgehammer approach to refreshing annotations.
     * @param annotation The annotation to centre on.
     */
    refreshRecords: function(annotation){
        this.removeAllFeatures(this.getRecordsLayer());
        this.showRecordsLayer(annotation);
    },

    /**
     * Remove layer from map.
     * @param layer.
     */
    removeLayer: function(layer){
        this.map.removeLayer(layer);
    },

    /**
     * Remove a layer from the registered layers in localstorage
     * @param {String} the id of the layer to remove
     */
    removeLayersFromLayerList: function(layerId) {
        records.usingLocalStorage('layers')(function(layers) {
            delete layers[layerId];

            return layers;
        });
    },

    /**
     * Rotate the location market to given angle
     * @param angle
     */
    rotateLocationMarker: function(angle){
        var locateLayer = this.getLocateLayer();
        if(locateLayer && locateLayer.features.length > 0){
            var feature = locateLayer.features[0];
            feature.style.rotation = angle;
            locateLayer.drawFeature(feature);
        }
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
        this.setDefaultLonLat(extLonLat.x, extLonLat.y);
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
    showAnnotateLayer: function(evt){
        var layer = this.getAnnotateLayer();

        layer.setVisibility(true);
        //this.toolbar.activate();
        //layer.map.getControlsByClass('olControlPanel').activate();
    },

    /**
     * Show user's position.
     */
    showLocateLayer: function(){
        this.showLayer(this.getLocateLayer());
    },

    /**
     * Show details of a single annotation.
     * @param evt Map Click event.
     */
    showRecordDetail: function(evt){
        var feature = this.getFeatureFromEvent(this.getRecordsLayer(), evt);
        if(feature){
            var annotation = records.getSavedRecord(feature.attributes.id);

            // give plugins a change to process the click first
            var showDetails = true;
            if(this.recordClickListeners){
                $.each(this.recordClickListeners, function(i, func){
                    if(func(feature)){
                        showDetails = false;
                        return;
                    }
                });
            }

            if(showDetails){
                this.showRecordDetailPopup(annotation);
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
        var $popup = $('#map-record-popup').popup({
            positionTo: '#map'
        });

        $('#map-record-popup a.close').one('vclick', function(event){
            $popup.popup('close');
        });

        $popup.one({
            popupbeforeposition: $.proxy(function() {
                var maxHeight;
                var containerHeight;
                var contentHeight;
                var record = annotation.record;
                var showRecord = function(html){
                    $('#map-record-popup-text').append(html).trigger('create');
                };

                $('#map-record-popup h3').text(record.name);
                $('#map-record-popup-text').text('');

                $.each(record.properties.fields, function(i, entry){
                    var html;
                    var type = records.typeFromId(entry.id);

                    if(entry.val !== null){
                        if(type === 'image'){
                            html = '<img src="' + entry.val + '" width=100%"/>';
                            showRecord(html);
                        }
                        else if(type === 'multiimage'){
                            html = "";
                            for(var j=0; j<entry.val.length;j++){
                                html += '<img src="' + entry.val[j] + '" width=100%"/>';
                            }
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
                    }
                });

                // append coords
                var point = this.pointToExternal(record.geometry.coordinates);
                var coords = '<p id="coords"><span> Coordinates</span>: (' +
                    point.lon + ', '+ point.lat +')</p>';
                showRecord(coords);

                // Set the max height of the popup container
                maxHeight = $('#map').height() - 60;
                $popup.parent().css('max-height', maxHeight + 'px');

                // Reset the height of the content to check if fits into the container
                $('#map-record-popup').css('height', '100%');
                contentHeight = $('#map-record-popup').height();

                // Force to fit into the container
                $('#map-record-popup')
                    .css('height', Math.min(maxHeight, contentHeight) + 'px');
            }, this)
        });
    },

    /**
     * Display records on map.
     */
    showRecordsLayer: function(annotation){
        var layer = this.getRecordsLayer();
        if(layer === undefined){
            // map hasn't been initialised yet
            this.showRecordsOnDisplay = annotation;
        }
        else{
            var features = [];
            $.each(records.getSavedRecords(), $.proxy(function(id, annotation){
                var record = annotation.record || {};
                if( typeof(record.geometry) === 'object' &&
                    record.geometry.coordinates !== undefined){

                    features.push(
                        this.createMarker(
                            {
                                id: id,
                                annotation: annotation
                            }
                        )
                    );
                }
                else{
                    console.debug("record " + id + " has no location");
                }
            }, this));
            this.addMarkers(layer, features);
            if(annotation){
                var point = this.getCentroid(annotation.record.geometry);
                this.setCentre({
                    lon: point.x,
                    lat: point.y,
                    zoom: undefined,
                    external: false
                });
            }
            this.showLayer(layer);
            //layer.refresh(); remove? put back in if ol refresh problem
        }
    },

    /**
     * Start to update the location
     * @param options.autopan 'soft' keep the marker in a centered bounding box
     *                        'centre' pan the marker to the center of the screen
     */
    startLocationUpdate: function(options){
        options = options || {};

        if(this.getLocateLayer()){
            this.stopLocationUpdate();

            this.geoLocate({
                secretly: true,
                updateAnnotateLayer: false,
                useDefault: false,
                watch: true,
                autopan: options.autopan
            });
        }
    },

    /*
     * Clear the current timer for the automatic location update
     */
    stopLocationUpdate: function(){
        this.clearGeoLocateWatch();
    },

    /*
     * Stop the compass
     */
    stopCompass: function(){
        if(navigator.compass !== undefined){
            navigator.compass.clearWatch(this.compassWatchID);
            this.compassWatchID = null;
            this.rotateLocationMarker(0);
        }
    },

    /**
     * Switch base layers.
     * @param layer New base layer.
     */
    switchBaseLayer: function(layer){
        if(this.map.baseLayer !== null){
            // remove old base layer
            this.map.removeLayer(this.map.baseLayer);

            // clear all layers
            this.clearAllLayers();
        }

        console.debug("switch base layer to " + layer.url);

        this.map.addLayer(layer);
        this.map.setBaseLayer(layer);

        // make sure switching doesn't leave
        // the user at a zoom level that is not available
        if(this.getZoom() < this.minLocateZoomTo){
            this.map.setCenter(this.userLonLat, this.minLocateZoomTo);
        }
    },

    /**
     * function for getting the latitude from y and z
     * @return latitude
     */
    tileTMS2lat: function (y,z) {
        var ymax = 1 << z;
        y = ymax - y - 1;
        return this.tile2lat(y,z);
    },

    /**
     * function for getting the latitude from y and z
     * @return latitude
     */
    tile2lat: function (y,z) {
        var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
        return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
    },

    /**
     * function for getting the longitude from x and z
     * @return longitude
     */
    tile2long: function(x,z) {
        return (x/Math.pow(2,z)*360-180);
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
            lonLat: lonlat,
            autocentre: true
        });

        this.showAnnotateLayer();
    },

    /**
     * Update annotate layer centred on geojson geometry.
     * @param geom geojson geometry
     */
    updateAnnotateLayerByGeometry: function(geom){
        if(geom.type === 'Point'){
            var coords = geom.coordinates;
            this.updateAnnotateLayer(new OpenLayers.LonLat(coords[0], coords[1]));
        }
        else{
            console.debug("Type " + geom.type + " not yet supported");
        }
    },

    /**
     * Update locate layer with users geo location.
     * @param options.autocentre (true|false) Center the map after update
     * @param options.autopan (soft|centre) Pan the map after update
     * @param options.zoom (true|false) Zoom the map after update
     */
    updateLocateLayer: function(options){
        var zoom;
        options = options || {};
        if(options.zoom){
            zoom = this.getZoom();
            if(zoom < this.minLocateZoomTo){
                zoom = this.minLocateZoomTo;
            }
        }

        this.updateLayer({
            layer: this.getLocateLayer(),
            id: this.USER_POSITION_ATTR,
            zoom: zoom,
            autocentre: options.autocentre,
            autopan: options.autopan
        });

        this.showLocateLayer();
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
        //Openlayers shortcuts
        var DrawFeature = OpenLayers.Control.DrawFeature;
        var RegularPolygon = OpenLayers.Handler.RegularPolygon;

        // get proj4js 2.x working with openlayer 2.13, see
        // http://osgeo-org.1560.x6.nabble.com/OL-2-13-1-latest-Proj4js-td5081636.html
        window.Proj4js = {
            Proj: function(code) { return proj4(Proj4js.defs[code]); },
            defs: proj4.defs,
            transform: proj4
        };

        var bounds;
        if(this.isOSM()){
            baseLayer = new OpenLayers.Layer.OSM(
                'OpenStreetMap',
                [
                    'https://a.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'https://b.tile.openstreetmap.org/${z}/${x}/${y}.png',
                    'https://c.tile.openstreetmap.org/${z}/${x}/${y}.png'
                ]
            );
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
            bounds = new OpenLayers.Bounds(
                BOUNDS[0],
                BOUNDS[1],
                BOUNDS[2],
                BOUNDS[3]
            );

            var proj = mapSettings.epsg;
            Proj4js.defs[proj] = mapSettings.proj;
            internalProjectionText = proj;
            baseLayer = new OpenLayers.Layer.TMS(
                "osOpen",
                // TODO - shouldn't this be utils.getTMSURL() ?
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
            graphicZIndex: 1,
            strokeColor: "yellow",
            fillColor: "yellow",
            fillOpacity: 0.3
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

        var captureRecordLayer = new OpenLayers.Layer.Vector(
            PADDLE_RECORD,
            {
                style: positionMarkerStyle,
                visibility: false
            }
        );

        // user location layer
        var locateLayerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        locateLayerStyle.externalGraphic = "css/images/user-location@2x.png";
        locateLayerStyle.graphicWidth = 30;
        locateLayerStyle.graphicHeight = 30;
        locateLayerStyle.graphicOpacity = 1;
        locateLayerStyle.rotation = 0;
        var locateLayer = new OpenLayers.Layer.Vector(
            USER_LOCATION,
            {
                style: locateLayerStyle,
            }
        );

        var drawFeatureListeners = {
            activate: function(evt) {
                evt.object.layer.removeAllFeatures();
            }
        };
        var selectAreaOptions = {
            title: 'Select an area',
            // displayClass: 'olLocationFileSelectArea',
            handlerOptions: {
                sides: 4,
                irregular:true,
                persistent: false
            },
            type: OpenLayers.Control.TYPE_TOOL,
            eventListeners: drawFeatureListeners
        };

        var selectLineOptions = {
            title: 'Select a line',
            type: OpenLayers.Control.TYPE_TOOL,
            eventListeners: drawFeatureListeners
        };

        var selectPolygonOptions = {
            title: 'Select a line',
            type: OpenLayers.Control.TYPE_TOOL,
            eventListeners: drawFeatureListeners
        };

        var drawControls = {
            pointDrag: new OpenLayers.Control.DragFeature(captureRecordLayer),
            point: new OpenLayers.Control.DrawFeature(captureRecordLayer, OpenLayers.Handler.Point),
            line: new DrawFeature(captureRecordLayer,
                        OpenLayers.Handler.Path, selectLineOptions),
            polygon: new DrawFeature(captureRecordLayer,
                        OpenLayers.Handler.Polygon, selectPolygonOptions),
            box: new DrawFeature(captureRecordLayer,
                RegularPolygon, selectAreaOptions),
            drag: new OpenLayers.Control.DragFeature(captureRecordLayer)
        };
        this.controls = drawControls;

        var clearRecordLayer = function(){
            if (captureRecordLayer.features.length > 0) {
                captureRecordLayer.removeAllFeatures();
            }
        };
        captureRecordLayer.events.register("beforefeatureadded", null, clearRecordLayer);
        drawControls.point.events.register('featureadded', drawControls.point, $.proxy(function(evt) {
            this.userLonLat.markerMoved = true;
        }, this));

        var toolbar = new OpenLayers.Control.Panel({
            //displayClass: options.olToolBarClass,
            allowDepress: true
        });

        var toolbarControls = [];
        for(var key in drawControls) {
            toolbarControls.push(drawControls[key]);
            this.map.addControl(drawControls[key]);
        }


        toolbar.addControls(toolbarControls);
        this.toolbar = toolbar;
        this.map.addControl(toolbar);
        toolbar.deactivate();

        // add layers to map
        this.map.addLayers([captureRecordLayer,
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

        var geodesic = false; // recommended for EPSG:4326
        if(this.externalProjectionText === 'EPSG:900913'){
            geodesic = true;
        }
        this.map.addControl(new OpenLayers.Control.ScaleLine({geodesic: geodesic}));

        // create default user position
        this.userLonLat = new OpenLayers.LonLat(
            defaultUserLon,
            defaultUserLat);
        this.userLonLat.gpsPosition = {
            longitude: defaultUserLon,
            latitude: defaultUserLat,
            heading: defaultUserHeading,
            altitude: defaultUserAltitude
        };

        drawControls.point.activate();

        this.minLocateZoomTo = this.map.getNumZoomLevels() - 3;
        this.setCentre({
            lon: defaultUserLon,
            lat: defaultUserLat,
            zoom: this.minLocateZoomTo,
            external: true
        });

        fetchCapabilities();
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
                    format: new OpenLayers.Format.GPX({
                        internalProjection: this.internalProjection
                    })
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
     * Add a KML layer to the map.
     * @param options
     *   id - layer id
     *   url - location of the KML file.
     * @return new KML vector layer.
     */
    addKMLLayer: function(options){
        var layer = new OpenLayers.Layer.Vector(
            options.id,
            {
                strategies: [new OpenLayers.Strategy.Fixed()],
                protocol: new OpenLayers.Protocol.HTTP({
                    url: options.url,
                    format: new OpenLayers.Format.KML({
                        internalProjection: this.internalProjection
                    })
                }),
                projection: this.externalProjection
            }
        );

        this.map.addLayer(layer);
        return layer;
    },

    /**
     * Add a geoJSON layer to the map
     * @param name - the name of the layer
     * @param geoJSON - a geoJSON
     * @returns a new vector layer added to the map
     */
    addGeoJSONLayer: function(name, geoJSON) {
        var features = (new OpenLayers.Format.GeoJSON()).read(geoJSON);
        var mapProjection = this.getProjections()[0];
        var geoJSONCRS = this.crsTextFromGeoJSON(geoJSON);
        var geoJSONProjection;

        var vectorLayer = new OpenLayers.Layer.Vector(name);

        geoJSONProjection = new OpenLayers.Projection(geoJSONCRS);
        features.map(function(feature) {
            if (feature.geometry) {
                feature.geometry.transform(geoJSONProjection, mapProjection);
            }
            else {
                console.warn('Feature doesn\'t contain a geometry to transform');
            }
        });

        vectorLayer.addFeatures(features);

        this.map.addLayer(vectorLayer);

        return vectorLayer;
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
     * Add multiple markers to the openlayers map.
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
     * Remove all features from all layers in the map.
     */
    clearAllLayers: function(){
        $.each(this.map.layers, function(i, layer){
            layer.removeAllFeatures();
        });
    },

    /**
     * Create openlayers clone of main map.
     * @param options
     *   div - html div to attach map
     *   zoom - current zoom level
     */
    createClone: function(options){
        var mapOptions = this.getOptions();
        var clone = new OpenLayers.Map(
            options.div,
            {
                controls: [],
                projection: mapOptions.projection,
                displayProjection: mapOptions.displayProjection,
                units: 'm',
                resolutions: mapOptions.resolutions,
                maxExtent: mapOptions.maxExtent,
                theme: null,
            }
        );

        var layer;
        var baseLaser = this.getBaseLayer();
        if(baseLaser instanceof OpenLayers.Layer.OSM){
            layer = new OpenLayers.Layer.OSM(
                baseLaser.name + '_' + options.zoom,
                baseLaser.url
            );
        }
        else{
            layer = new OpenLayers.Layer.TMS(
                "os",
                baseLaser.url,
                {
                    layername: baseLaser.layername,
                    type: baseLaser.type
                }
            );
        }

        clone.addLayer(layer);
        clone.setBaseLayer(layer);

        clone.getBaseLayer = function(){
            return clone.baseLaser;
        };
        clone.getCentre = function(){
            return clone.getCenter();
        };
        clone.getTileFileType = function(){
            return 'png';
        };

        return clone;
    },

    /**
     * Create a marker for a given FT annotation.
     * @param options
     *   id - Annotation id
     *   annotation - FT annotation object.
     * @return OpenLayers.Feature.Vector
     */
    createMarker: function(options){
        var annotation = options.annotation;
        var geojsonFormat = new OpenLayers.Format.GeoJSON();
        return new OpenLayers.Feature.Vector(
            geojsonFormat.parseGeometry(annotation.record.geometry),
            {
                'id': options.id,
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
     * enable control, point, line, polygon, box on the map
     * @param controlName {String}
     * @param updateAnnotateLayer {Boolean} update Annotate Layer
     */
    enableControl: function(controlName, updateAnnotateLayer){
        for(var key in this.controls) {
            var control = this.controls[key];
            if(controlName === key) {
                if(controlName === "point" && updateAnnotateLayer){
                    this.updateAnnotateLayer(this.getUserCoords());
                }
                control.activate();
                $("#draw-"+controlName).removeClass("hide");
            } else {
                control.deactivate();
                if(!$("#draw-"+key).hasClass("hide")){
                    $("#draw-"+key).addClass("hide");
                }
            }
        }
    },

    /**
     * Get current annotation coords (the paddle location).
     * @param ext In external projection? If not internal.
     * @return Current annotation coordinates.
     */
    getAnnotationCoords: function(ext){
        var coords, centroid;
        var features = this.getAnnotateLayer().features;

        if(features.length > 0){
            var geom = features[0].geometry;
            var geoJSON = new OpenLayers.Format.GeoJSON();
            centroid = geom.getCentroid();
            //coords = new OpenLayers.LonLat(geom.x, geom.y);
            if(ext){
                geom = this.toExternal(geom);
            }
            coords = JSON.parse(geoJSON.write(geom));

            // give the annotation altitude the altitude of the user
            // see https://redmine.edina.ac.uk/issues/5497
            if(geom instanceof OpenLayers.Geometry.Point){
                coords.gpsPosition = this.userLonLat.gpsPosition;
                coords.markerMoved = this.userLonLat.markerMoved;
            }
        }

        return {geometry: coords, centroid: centroid};
    },

    /**
     * @return openlayers base layer.
     */
    getBaseLayer: function(){
        return this.map.baseLayer;
    },

    /**
     * get centroid of geojson
     * @param {Object} geometry of geojson
     * @returns OpenLayers.Point
     */
    getCentroid: function(geometry){
        var geojsonFormat = new OpenLayers.Format.GeoJSON();
        return geojsonFormat.parseGeometry(geometry).getCentroid();
    },

    /**
     * Get clicked on feature.
     * @param layer openlayers layer
     * @ event click event.
     * @return openlayers feature based on click event.
     */
    getFeatureFromEvent: function(layer, e){
        return layer.getFeatureFromEvent(e);
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
     * Get all features on a layer.
     * @param layer
     * @return array of Openlayers features.
     */
    getLayerFeatures: function(layer){
        return layer.features;
    },

    /**
     * @param layer
     * @return The name of the layer.
     */
    getLayerName: function(layer){
        return layer.name;
    },

    /**
     * Get openlayers map
     * @return The map instance
     */
    getMap: function() {
        return this.map;
    },

    /**
     * Hide openlayers map layer.
     * @param layer - the layer to hide.
     */
    hideLayer: function(layer){
        layer.setVisibility(false);
    },

    /**
     * Hide layers whose name startswith layerName.
     * @param layerName
     */
    hideLayerByName: function(layerName){
        $.each(this.map.layers, $.proxy(function(i, layer){
            if(layer.name.substr(0, layerName.length) === layerName){
                this.hideLayer(layer);
            }
        }, this));
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
     * Does the layer exists on map?
     * @param name of the layer
     * @return true, false
     */
    layerExists: function(name){
        return (this.map.getLayersByName(name).length > 0);
    },

    /**
     * move layer over Annotation layer
     * @para layer {Object}
     */
    moveLayerUnderAnnotation: function(layer){
        this.map.setLayerIndex(this.getAnnotateLayer(), this.map.getLayerIndex(layer));
    },

    /**
     * Pan the map to the location marker if none get a location
     */
    panToLocationMarker: function(){
        var layer = this.getLocateLayer();
        var updateOptions = {
                              autocentre: true,
                              zoom: true
                            };
        if(layer.features && layer.features.length > 0){
            this.updateLocateLayer(updateOptions);
        }else{
            this.getLocation(function(position){
                _this.updateUserPosition(position.coords.longitude,
                                         position.coords.latitude);
                _this.updateLocateLayer(updateOptions);
            });
        }
    },

    /**
     * Covert a point object to external projection.
     * @param point A point object with internal projection.
     * @return A point object reprojected to external projection.
     */
    pointToExternal: function(point){
        var lonLat = this.toExternal(new OpenLayers.LonLat(point[0], point[1]));
        return {
            'lon': lonLat.lon,
            'lat': lonLat.lat
        };
    },

    /**
     * Convert a point to the internal projection
     * @param point can be an object with the lat/lon or longitude/latitude or
     *        a longitude, latitude array
     * @return A point object reprojected to internal projection if longitude and
     *         latitude where used in the input the return value use those keys
     */
    pointToInternal: function(point) {
        var latitude;
        var longitude;
        var lonLat;
        var retValue = {};
        var fullNames = false;

        if (Array.isArray(point)) {
            longitude = point[0];
            latitude = point[1];
        }
        else {
            if (point.latitude !== undefined && point.longitude !== undefined) {
                longitude = point.longitude;
                latitude = point.latitude;
                fullNames = true;
            }
            else if (point.lat !== undefined && point.lon !== undefined) {
                longitude = point.lon;
                latitude = point.lat;
            }
        }

        lonLat = this.toInternal(new OpenLayers.LonLat(longitude, latitude));

        if (fullNames) {
            retValue.longitude = lonLat.lon;
            retValue.latitude = lonLat.lat;
        }
        else {
            retValue.lon = lonLat.lon;
            retValue.lat = lonLat.lat;
        }

        return retValue;
    },

    /**
     * Register selected/unselected events for the features in the map
     * @param layer {Openlayers.Layer} a layer in the map
     * @param handler {Object}
     *     - selected {function} hsndler to be invoked when the feature is selected
     *     - unselected {function} handler to be invoked when the feacture is unselected
     */
    registerFeatureEvents: function(layer, handler) {
        var control ;

        if (!(handler.selected || handler.unselected)) {
            console.warn('Nothing to register');
            return;
        }

        control = new OpenLayers.Control.SelectFeature(layer);

        if (handler.selected) {
            layer.events.register('featureselected', layer, handler.selected);
        }

        if (handler.unselected) {
            layer.events.register('featureunselected', layer, handler.unselected);
        }

        this.map.addControl(control);
        control.activate();
    },

    /**
     * Register an object and function to receive map zoom change updates.
     * @param callback
     * @param obj - Object scope
     */
    registerZoom: function(callback, obj){
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
     * Set the style for a layer
     * @param layer {OpenLayers.Layer} a layer where to apply the style
     * @param style {Object} a css style as javascript Object
     * @param name {String} (optional) the name of the style 'default' as default
     */
    setLayerStyle: function(layer, style, name) {
        name = name || 'default';
        layer.styleMap.styles[name] = new OpenLayers.Style(style);
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
        layer.setVisibility(true);
        var geom = new OpenLayers.Bounds(bounds.left,
                                         bounds.bottom,
                                         bounds.right,
                                         bounds.top).toGeometry();

        layer.addFeatures([new OpenLayers.Feature.Vector(geom)]);

        this.setCentre({
            lon: poi.lon,
            lat: poi.lat,
            zoom: poi.zoom
        });
        this.map.zoomToExtent(geom.bounds);
    },

    /**
     * Show layer on map.
     * @param layer
     */
    showLayer: function(layer){
        layer.setVisibility(true);
    },

    /**
     * show layer by name
     * @param layerName
     */
    showLayerByName: function(layerName){
        $.each(this.map.layers, $.proxy(function(i, layer){
            if(layer.name.substr(0, layerName.length) === layerName){
                this.showLayer(layer);
            }
        }, this));
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
     * Reproject internal geom.
     * @param Internal geom.
     * @return Cloned external geom
     */
    toExternal: function(geom){
        return geom.clone().transform(
            this.internalProjection,
            this.externalProjection);
    },

    /**
     * Reproject geojson to external geom
     * @param record {Object}
     * @returns record {Object}
     */
    toExternalGeojson: function(record){
        var geojsonFormat = new OpenLayers.Format.GeoJSON();
        record.geometry = JSON.parse(geojsonFormat.write(this.toExternal(geojsonFormat.parseGeometry(record.geometry))));
        return record;
    },

    /**
     * Update a vector layer centred on users location.
     * options:
     *   layer: The layer to update.
     *   id: The id of the user icon feature.
     *   zoom: The map zoom level to zoom to.
     *   lonLat: The current location of the user.
     *   autocentre: True or False if we want to centre the map after updating the location, false by default
     *   autopan: 'soft' keep the marker in a centered bounding box
     *            'centre' pan the marker to the center of the screen
     */
    updateLayer: function(options){
        var id = options.id;
        var layer = options.layer;
        var annotationFeature = layer.getFeaturesByAttribute('id', id);
        var lonLat = options.lonLat;
        options.autocentre = options.autocentre || false;

        if(lonLat === undefined || lonLat === null){
            lonLat = this.toInternal(this.userLonLat);
        }
        var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);

        if(lonLat.gpsPosition){
            point.gpsPosition = lonLat.gpsPosition;
        }

        // Create or move the feature
        if(annotationFeature.length === 0){
            var v = new OpenLayers.Feature.Vector(point, {'id': id});
            annotationFeature = [v];
            layer.addFeatures(annotationFeature);
        }
        else {
            annotationFeature[0].move(lonLat);
        }

        var feature = annotationFeature[0];
        layer.drawFeature(feature);

        var mapBounds = this.map.calculateBounds();
        var innerBounds = mapBounds.clone().scale(0.7);
        var featureBounds = feature.geometry.bounds;

        if(options.autopan === 'soft'){
            // If is not in the viewport center the map
            if(!mapBounds.containsBounds(featureBounds)){
                this.map.setCenter(lonLat, options.zoom);
            }
            else{
                // If is in the edge of the map pan the map
                if(!innerBounds.containsBounds(featureBounds)){
                    // Calculate how much to pan
                    var innerGeometry = innerBounds.toGeometry();
                    var delta = point.distanceTo(innerGeometry, {details: true});
                    var center = this.map.getCenter();
                    center.lon -= (delta.x1 - delta.x0);
                    center.lat -= (delta.y1 - delta.y0);
                    this.map.panTo(new OpenLayers.LonLat(center.lon, center.lat));
                }
            }
        }else if(options.autopan === 'centre'){
            this.map.panTo(lonLat, options.zoom);
        }
        else{
            if(options.autocentre === true){
                this.map.setCenter(lonLat, options.zoom);
            }
        }
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
     * Set up leaflet map.
     */
    init: function(){
        if(this.isOSM()){
            this.maxZoom = 18;
        }
        else{
            this.maxZoom = resolutions.length -1;
        }

        this.minLocateZoomTo = this.maxZoom - 2;
    },

    /**
     * Add geojson layer to map.
     * @param data Geojson object.
     * @param icon is a function that is executed for each point on the layer.
     * It expects and icon object to be returned.
     * @param callback Function executed on feature click.
     */
    addGeoJSONLayer: function(data, icon, callback){
        var layer;
        if(this.map){
            layer = L.geoJson(data, {
                pointToLayer: $.proxy(function(feature, latlng) {
                    return L.marker(
                        latlng,
                        {
                            icon: icon(feature)
                        }).addTo(this.map);
                }, this),
                onEachFeature: function (feature, layer) {
                    layer.on('click', function(){
                        callback(feature, layer);
                    });
                }
            }).addTo(this.map);
        }

        return layer;
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
     * @param layer
     */
    addLayer: function(layer){
        this.map.addLayer(layer);
    },

    /**
     * Add a marker to the given layer.
     * @param point Marker latlon.
     * @param icon A leaflet icon.
     * @param layer
     * @return Newly created marker.
     */
    addMarker: function(point, icon, layer){
        var marker = new L.marker(
            new L.LatLng(point.lat, point.lon),
            {
                icon: icon
            }
        );

        layer.addLayer(marker);
        return marker;
    },

    /**
     * Add miscellaneous layer on the map
     * @param layer to add.
     */
    addMapLayer: function(layer){
        this.addLayer(layer);
    },

    /**
     * Add multiple markers to the map.
     * @param layer The layers to add the markers to.
     * @param markers An array of markers.
     */
    addMarkers: function(layer, markers){
        $.each(markers, function(i, marker){
            layer.addLayer(marker);
        });
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
     * Close currently displayed popup.
     */
    closePopup: function(){
        this.map.closePopup();
    },

    /**
     * Create a bounding box.
     * @param sw Botton left.
     * @param ne Top right
     * @return L.latLngBounds
     */
    createBounds: function(sw, ne){
        return new L.latLngBounds(sw, ne);
    },

    /**
     * Create leaflet map.
     * @param div The div to attach the map to.
     */
    createMap: function(div){
        if(this.isOSM()){
            this.map = L.map(div);

            // create base layer
            this.baseLayer = L.tileLayer(
                'http://{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpg',
                {
                    subdomains: ['otile1', 'otile2', 'otile3', 'otile4'],
                    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
                    maxZoom: this.maxZoom
                }
            );
        }
        else{
            this.baseLayer = L.tileLayer(
                this.getTMSURL() + mapSettings.version + "/" + mapSettings.layerName + '/{z}/{x}/{y}.' + mapSettings.type,
                {
                    attribution: 'FieldTripGB tiles provided by <a href="http://edina.ac.uk/">EDINA</a>  | Map data Â© <a href="http://openstreetmap.org/">OpenStreetMap</a>',
                    continuousWorld: true,
                    tms: true,
                    maxZoom: this.maxZoom,
                    bounds: [[60.8400, 1.7800],[49.9600, -7.5600]]
                }
            );

            var crs = new L.Proj.CRS.TMS(
                mapSettings.epsg,
                mapSettings.proj,
                BOUNDS,
                {
                    resolutions: resolutions
                }
            );

            this.map = L.map(div, {
                crs: crs,
                maxBounds: this.baseLayer.options.bounds
            });
        }

        this.baseLayer.addTo(this.map);
    },

    /**
     * Create a marker for a given FT annotation.
     * @param options:
     *   id - Annotation id
     *   annotation - FT annotation object.
     *   icon - Leaflet icon.
     *   click - marker click handler function.
     * @return L.marker
     */
    createMarker: function(options){
        var annotation = options.annotation;
        var icon = options.icon;
        var click = options.click;

        if(icon === undefined){
            var className = 'custom-marker-icon';
            if(annotation.record.editor === 'text.edtr'){
                className = 'text-marker-icon';
            }
            else if(annotation.editor === 'image.edtr'){
                className = 'image-marker-icon';
            }
            icon = L.divIcon({
                className: className,
                iconSize: [35, 50]
            });
        }

        var marker = new L.marker(
            [annotation.record.point.lat, annotation.record.point.lon],
            {icon: icon}
        );

        // attach attributes to marker, matches features in openlayers
        marker.attributes = {
            id: options.id,
            type: annotation.record.type
        };

        // default click event handler is display record
        var defaultMarkerClick = function(e){
            this.showRecordDetail(e);
        };

        if(click === undefined){
            // default handler is show record detail
            click = $.proxy(this.showRecordDetail, this);
        }

        marker.on('click', click);

        return marker;
    },

    /**
     * Creat cluster group for markers.
     * @return L.markerClusterGroup.
     */
    createMarkerLayer: function(){
        return new L.markerClusterGroup();
    },

    /**
     * Render the map on a defined div. Note the difference in the way the
     leaflet map is enabled. As it has no render function it need to be
     initialised each time the page is displayed.
     * @param div The div id.
     */
    display: function(div){
        this.createMap(div);

        // set up listeners
        if(this.dragend){
            this.map.on('dragend', this.dragend);
        }
        if(this.zoomend){
            this.map.on('zoomend', this.zoomend);
        }
        if(this.onready){
            this.map.on('load', this.onready);
        }

        this.layers = {};

        // records layer
        var recordsLayer = L.layerGroup();
        this.layers[RECORDS_LAYER] = recordsLayer;
        recordsLayer.addTo(this.map);

        var centre = [defaultUserLat, defaultUserLon];
        if(this.userLonLat){
            centre = [this.userLonLat.lat, this.userLonLat.lng];
        }

        // annotate layer
        var annotateLayer = new L.marker(
            centre,
            {
                draggable:'true',
                icon: L.divIcon({
                    className: 'annotate-marker-icon',
                    iconSize: [65, 65]
                }),
            }
        );
        this.layers[PADDLE_RECORD] = annotateLayer;
        annotateLayer.addTo(this.map);

        if(this.showRecordsOnDisplay){
            // a request to show record was made before map was initialised
            this.showRecordsLayer(this.showRecordsOnDisplay);
            this.showRecordsOnDisplay = undefined;
        }
        else{
            this.map.setView(centre, this.minLocateZoomTo);
        }
    },

    /**
     * Get current annotation coords (the paddle location).
     * @param ext In external projection? If not internal.
     * @return Current annotation coordinates.
     */
    getAnnotationCoords: function(ext){
        var lonLat = this.layers[PADDLE_RECORD].getLatLng();
        lonLat.lon = lonLat.lng;
        return lonLat;
    },

    /**
     * @return leaflet base layer.
     */
    getBaseLayer: function(){
        return this.baseLayer;
    },

    /**
     * @return Current map extent/Bounds.
     */
    getExtent: function(){
        return this.map.getBounds();
    },

    /**
     * Get feature for a marker click event. In leaflet just return the target.
     * @return event target.
     */
    getFeatureFromEvent: function(layer, e){
        return e.target;
    },

    /**
     * Get layer group.
     * @param layerName
     * @return Leaflet layer by name.
     */
    getLayer: function(layerName){
        if(this.map){
            return this.layers[layerName];
        }
    },

    /**
     * Get all features on a layer.
     * @param layer
     * @return array of leaflet leaflet layers.
     */
    getLayerFeatures: function(layer){
        if(layer && layer.getLayers){
            return layer.getLayers();
        }
        else{
            return [];
        }
    },

    /**
     * @return The coordinates of the user, in external projection, based on the
     * position of the user icon.
     */
    getLocateCoords: function(){

    },

    /**
     * @return Leaflet map.
     */
    getMap: function(){
        return this.map;
    },

    /**
     * Hide leaflet map layer.
     * @param layer The layer to hide.
     */
    hideLayer: function(layer){
        if(this.map){
            this.map.removeLayer(layer);
        }
    },

    /**
     * @return Is the base layer map a TMS?
     */
    isBaseLayerTMS: function(){
        return true;
    },

    /**
     * @param The leaflet map layer.
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
     * Register an object and function to receive map initialised event.
     * @param callback
     * @param obj Optional object scope
     */
    registerReady: function(callback, obj){
        // TODO - support multiple listerners
        this.onready = $.proxy(callback, obj);
    },

    /**
     * Register an object and function to receive map pan events.
     * @param callback
     * @param obj Optional object scope
     */
    registerPan: function(callback, obj){
        // TODO - support multiple listerners
        this.dragend = $.proxy(callback, obj);
    },

    /**
     * Register an object and function to receive map zoom change updates.
     * @param callback
     * @param obj Optional object scope
     */
    registerZoom: function(callback, obj){
        // TODO - support multiple listerners
        this.zoomend = $.proxy(callback, obj);
    },

    /**
     * Remove all features from layer. In leaflet just remove the layer from map.
     * @param layer.
     */
    removeAllFeatures: function(layer){
        layer.removeLayer(this.map);
    },

    /**
     * Centre map with zoom level.
     * options:
     *   lon
     *   lat
     *   zoom
     *   external - use external projection (TODO?).
     */
    setCentre: function(options){
        var zoom = options.zoom;
        if(!zoom){
            zoom = this.getZoom();
            if(!zoom){
                zoom = this.minLocateZoomTo;
            }
        }
        this.map.setView(
            L.latLng(options.lat, options.lon),
            zoom
        );
    },

    /**
     * Show layer on map.
     * @param layer
     */
    showLayer: function(layer){
        if(layer){
            layer.addTo(this.map);
        }
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
        // currently no reprojection being done
        return point;
    },

    /**
     * Update a vector layer centred on users location.
     * options:
     *   layer: The layer to update.
     *   id: The id of the icon feature.
     *   zoom: The map zoom level to zoom to.
     *   lonLat: The current location of the user.
     */
    updateLayer: function(options){
        var layer = options.layer;
        if(layer){
            //layer.clearLayers()
            //var pos = options.lonLat
            //L.marker([pos.lat, pos.lng], ).addTo(this.map);
        }
    },

    /**
     * Update map size after dynamic change in map size.
     */
    updateSize: function(options){
        // doesn't apply to leaflet
    },

    /**
     * Update user position.
     * @param lon
     * @param lat
     */
    updateUserPosition: function(lon, lat){
        this.userLonLat = L.latLng(lat, lon);
    },

    /**
     * Zoom map.
     * @param levels Number of zoom levels to zoom.
     */
    zoomIn: function(levels){
        if(levels === undefined || typeof(levels) === 'object'){
            this.map.zoomIn();
        }
        else{
            this.map.zoomIn(levels);
        }
    }
};

if(utils.getMapLib() === 'leaflet'){
    require(['leaflet'], function(){
        require(['ext/leaflet.markercluster', 'ext/proj4leaflet'], function(){
            _this.init();
        });
    });
    $('head').prepend('<link rel="stylesheet" href="css/ext/leaflet.css" type="text/css" />');
    $.extend(_this, _base, _leaflet);
}
else{
    require(['ext/openlayers'], function(){
        _this.init();
    });
    $.extend(_this, _base, _openlayers);
}


return _this;

});
