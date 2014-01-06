"use strict";

Proj4js.defs["EPSG:27700"] = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";

/**
 * Openlayers map wrapper.
 * @params: options
 *    db          - storage object
 *    isMobileApp - is this running inside a mobile app?
 */
var Map = function(options) {
    this.storage = options.db;
    this.previews = {};
    this.serviceVersion = '1.0.0';

    var osOptions = {
        controls: [],
        projection: Map.INTERNAL_PROJECTION,
        units: 'm',
        resolutions: Map.RESOLUTIONS,
        maxExtent: new OpenLayers.Bounds (0,0,700000,1300000),
    }

    this.map = new OpenLayers.Map('map', osOptions);
    // styles for annotations
    var annotationsStyle = new OpenLayers.Style({
        pointRadius: 20,
        // labels don't work on android
        //label : "${title}",
        graphicOpacity: 1,
        graphicZIndex: 1
    });

    // annotation styles
    annotationsStyle.addRules([
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
        new OpenLayers.Rule({
            filter: new OpenLayers.Filter.Comparison({
                type: OpenLayers.Filter.Comparison.EQUAL_TO,
                property: 'type',
                value: 'track',
            }),
            symbolizer: {
                externalGraphic: 'css/images/routemarker.png',
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

    var styleMap = new OpenLayers.StyleMap({'default': annotationsStyle});
    var annotationsLayer = new OpenLayers.Layer.Vector(
        'annotationsWMS',
        {
            visibility: false,
            styleMap: styleMap
        }
    );

    // vector layer for dragging annotation marker
    var annotateLayerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    annotateLayerStyle.graphicOpacity = 1;
    annotateLayerStyle.graphicWidth = 65;
    annotateLayerStyle.graphicHeight = 64;
    annotateLayerStyle.externalGraphic = "css/images/marker.png";
    annotateLayerStyle.graphicYOffset = -64;
    var annotationLayer = new OpenLayers.Layer.Vector(
        'annotationMarker',
        {
            style: annotateLayerStyle,
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
        'locate',
        {
            style: locateLayerStyle,
        }
    );

    // layer displaying extent of saved maps
    var savedMapsStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    savedMapsStyle.fillOpacity = 0;
    savedMapsStyle.strokeWidth = 2;
    savedMapsStyle.strokeColor = 'red';
    var savedMapsLayer = new OpenLayers.Layer.Vector(
        'savedMaps',
        {
            visibility: false,
            style: savedMapsStyle,
        }
    );

    // GPS track layer
    var gpsTrackLayerStyle = OpenLayers.Util.extend(
        {}, OpenLayers.Feature.Vector.style['default']);
    gpsTrackLayerStyle.strokeColor = 'red';
    gpsTrackLayerStyle.strokeWidth = 5;
    var gpsTrackLayer = new OpenLayers.Layer.Vector(
        'gpsTrack',
        {
            style: gpsTrackLayerStyle,
        }
    );

    this.map.addLayers([annotationLayer,
                        annotationsLayer,
                        locateLayer,
                        savedMapsLayer,
                        gpsTrackLayer]);

    // override touch navigation class to access single click on map, this is
    // done due to FeatureSelect not working on the feature vector layer on android
    var TN = OpenLayers.Class(OpenLayers.Control.TouchNavigation, {
        defaultClick: $.proxy(this.showAnnotationDetail, this),
    });

    // this will allow non apps to work
    var select = new OpenLayers.Control.SelectFeature(annotationsLayer);
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

    //this.map.addControl(new OpenLayers.Control.Scale('scale'));
    this.map.addControl(new OpenLayers.Control.ScaleLine({geodesic: true}));
    //this.map.addControl(new OpenLayers.Control.LayerSwitcher());
    //this.map.addControl(new OpenLayers.Control.MousePosition());

    var drag = new OpenLayers.Control.DragFeature(annotationLayer);
    this.map.addControl(drag);
    drag.activate();

    this.geolocateTimeout = Map.GPS_LOCATE_TIMEOUT;

    // hack alert
    this.map.getNumZoomLevels = $.proxy(this.getNumZoomLevels, this);

    // create default user position
    this.userLonLat = new OpenLayers.LonLat(
        Map.DEFAULT_USER_LON,
        Map.DEFAULT_USER_LAT);
    this.userLonLat.gpsPosition = {
        longitude: Map.DEFAULT_USER_LON,
        latitude: Map.DEFAULT_USER_LAT,
        heading: 130,
        altitude: 150
    };
};

Map.RESOLUTIONS = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];

Map.MIN_LOCATE_ZOOM_TO = Map.RESOLUTIONS.length - 3;
Map.POST_LOCATE_ZOOM_TO_OPEN = Map.RESOLUTIONS.length - 1;
Map.POST_LOCATE_ZOOM_TO_CLOSED = 7;

Map.INTERNAL_PROJECTION = new OpenLayers.Projection("EPSG:27700")
Map.EXTERNAL_PROJECTION = new OpenLayers.Projection("EPSG:4326")

Map.GPS_ACCURACY = 50;
Map.GPS_LOCATE_TIMEOUT = 10000;
Map.GPS_ACCURACY_FLAG = false;

Map.ANNOTATE_POSITION_ATTR = 'annotate_pos';
Map.USER_POSITION_ATTR = 'user_pos';

Map.TMS_URL = '/mapcache/tms';

Map.DEFAULT_USER_LON = -2.421976;
Map.DEFAULT_USER_LAT = 53.825564;

/**
 * Delete current GPS track.
 */
Map.prototype.clearGPSTrack = function(){
    this.getGPSTrackLayer().removeAllFeatures();
};

/**
 * Fetch TMS capabilities from server and store as this.tileMapCapabilities.
 */
Map.prototype.fetchCapabilities = function(){
    var baseLayerName;

    this.tileMapCapabilities = {'tileSet': []};

    if(this.getOpenBaseLayer().visibility){
        baseLayerName = this.getOpenBaseLayer().layername;
        this.tileMapCapabilities['stack'] = 'open';
    }
    else{
        baseLayerName = this.getClosedBaseLayer().layername;
        this.tileMapCapabilities['stack'] = 'closed';
    }

    var applyDefaults = $.proxy(function(){
        this.tileMapCapabilities.tileFormat = {
            'height': 256,
            'width': 256
        }
        this.tileMapCapabilities.tileSet = Map.RESOLUTIONS;
    }, this);

    this.baseMapFullURL = Utils.getMapServerUrl() + Map.TMS_URL + this.serviceVersion + '/' + baseLayerName + '/';

    // fetch capabilities
    $.ajax({
        type: "GET",
        url: Utils.getMapServerUrl() + this.serviceVersion + '/' + baseLayerName + '/',
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
};

/**
 * Locate user on map.
 * @param interval Time gap between updates. If 0 update only once.
 * @param secretly If true do not show page loading msg.
 * @param updateAnnotateLayer Should annotate layer be informed of new position?
 * @param useDefault If no user location found should default be used?
 */
Map.prototype.geoLocate = function(options){
    console.debug("Geolocate user: interval: " + options.interval +
                  " secretly: " + options.secretly +
                  " updateAnnotateLayer: " + options.updateAnnotateLayer +
                  " useDefault " + options.useDefault);

    if(!options.secretly){
        Utils.inform('Waiting for GPS fix',10000);
    }

    // found user location
    var onSuccess = $.proxy(function(position){
        console.debug("Position found: "+position.coords.latitude+","+position.coords.longitude);
        this.onPositionSuccess(position, options.updateAnnotateLayer);
        $.mobile.hidePageLoadingMsg();
    }, this);

    // problem with geo locate
    var onError = $.proxy(function(error){
        if(error.code === 3){
            // timeout
            console.debug("GPS timed out: " + error.code);
            if(!options.secretly){
                Utils.inform('GPS timed out',5000);
            }
        }
        else{
            console.debug("GPS is not enabled");
            if(!options.secretly){
                Utils.inform('Your GPS needs to be enabled.',5000 );
            }
        }

        if(options.useDefault){
            //  just go to center of UK
            var pos = {
                coords: {
                    longitude: Map.DEFAULT_USER_LON,
                    latitude: Map.DEFAULT_USER_LAT,
                    heading: 130,
                    altitude: 150
                }
            }
            var dontHideLoadingDialog = true;
            this.onPositionSuccess(pos, options.updateAnnotateLayer, dontHideLoadingDialog);
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
                enableHighAccuracy: Map.GPS_ACCURACY_FLAG,
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
                enableHighAccuracy: Map.GPS_ACCURACY_FLAG,
                timeout: this.geolocateTimeout
            }
        );
    }
};

/**
 * @return Start position of current GPS track.
 */
Map.prototype.getGpsTrackStart = function(){
    var coords;

    var track = this.getGPSTrackLayer().features[0];

    if(track !== undefined){
        var features = track.geometry.components;
        if(features.length > 0){
            coords = {
                'lon': features[0].x,
                'lat': features[0].y,
            }
        }
        else{
            console.debug("No components in geometry");
        }
    }
    else{
        console.debug("No track defined");
    }

    return coords;
};

/**
 * Draw GPS track on map.
 * @param interval Time gap between updates. Must be more than 0.
 * @param callback Function to be executed on each good GPS coordinate, taking
 * into account the interval.
 * @param debug Use dummy GPS tracking.
 */
Map.prototype.gpsTrack = function(interval, callback, debug){
    this.debugGPS = debug;
    this.hideAnnotationsLayer();
    var layer = this.getGPSTrackLayer();

    if(!this.gpsLastRecorded){
        this.gpsLastRecorded = new Date();
    }

    layer.setVisibility(true);
    layer.style.strokeColor = this.storage.get('gps-track-color');
    this.getLocateLayer().setVisibility(false);

    if(layer.features.length === 0){
        var line = new OpenLayers.Geometry.LineString([]);
        layer.addFeatures([new OpenLayers.Feature.Vector(line)]);
    }

    // found location
    var onSuccess = $.proxy(function(position){
        var next = new Date(this.gpsLastRecorded.getTime() + interval);
        var timestamp = position.timestamp;

        if(typeof(timestamp) === 'number'){
            timestamp = new Date(timestamp);
        }

        if((position.coords.accuracy < Map.GPS_ACCURACY) && timestamp > next){
            this.gpsLastRecorded = timestamp;

            var lonLat = toNationalGrid(
                new OpenLayers.LonLat(
                    position.coords.longitude,
                    position.coords.latitude)
            );

            var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);
            layer.features[0].geometry.addPoint(point);

            // only redraw if map page is active
            if($.mobile.activePage.attr('id') === 'gpscapture-page' ||
               $.mobile.activePage.attr('id') === 'map-page'){
                layer.redraw();
            }

            console.debug("add point: " + position.coords.longitude + ' ' +
                          position.coords.latitude);
            callback(position);
        }
        else{
            console.debug("ignore point: " + position.coords.accuracy);
            console.debug(timestamp + " : " + next);
        }
    }, this);

    // timeout has been reached
    var onError = function(position){
        Utils.inform('Waiting for GPS signal');
    };

    // clear watch if already defined
    this.gpsTrackPause();

    if(this.debugGPS){
        // for testing
        console.debug("GPS track debug mode");

        var lon = -3.188889;
        var lat = 55.936;

        var points = layer.features[0].geometry.components;
        if(points.length > 0){
            // use last records point
            var coords = points[points.length - 1].clone().transform(
                Map.INTERNAL_PROJECTION, // from national grid
                Map.EXTERNAL_PROJECTION); // to WGS 1984

            lon = coords.x;
            lat = coords.y;
        }

        this.gpsTrackWatchID = setInterval($.proxy(function(){
            var now = new Date();
            var position = {
                'coords': {
                    'longitude': lon += Math.random() / 10000,
                    'latitude': lat += Math.random() / 10000,
                    'altitude': Math.random() * 100,
                    'accuracy': Math.random() * 100
                },
                'timestamp': now.getTime()
            }
            onSuccess(position);
        }, this), 1000);
    }
    else{
        this.gpsTrackWatchID = navigator.geolocation.watchPosition(
            onSuccess,
            onError,
            {
                enableHighAccuracy: Map.GPS_ACCURACY_FLAG,
                maximumAge: interval,
                timeout: 30000,
            }
        );
    }
};

/**
 * Clear GPS track watch.
 */
Map.prototype.gpsTrackStop = function(){
    this.gpsTrackPause();
    this.getGPSTrackLayer().removeAllFeatures();
};

/**
 * Pause GPS track.
 */
Map.prototype.gpsTrackPause = function(){
    if(this.gpsTrackWatchID){
        if(this.debugGPS){
            clearInterval(this.gpsTrackWatchID);
        }
        else{
            navigator.geolocation.clearWatch(this.gpsTrackWatchID);
        }

        this.gpsTrackWatchID = undefined;
    }
};

/**
 * Is a GPS track currently running?
 */
Map.prototype.gpsTrackRunning = function(){
    return this.gpsTrackWatchID !== undefined;
};

/**
 * Switch gps track layer on/off.
 */
Map.prototype.gpsTrackToggle = function(){
    var layer = this.getGPSTrackLayer();
    layer.setVisibility(!layer.visibility);
};

/**
 * @return GPS Track Geometry as a LineFeatureIterator.
 */
Map.prototype.getGPSTrack = function(){
    return new LineFeatureIterator(this.getGPSTrackLayer(), 0);
};

/**
 * @return GPS Track Geometry as a text string.
 */
Map.prototype.getGPSTrackGeometry = function(){
    return this.getGPSTrackLayer().features[0].geometry.toString();
};

/**
 * get current annotation coords.
 * @param wgs84 In WGS84? If not national grid.
 * @return Current annotation coordinates.
 */
Map.prototype.getAnnotationCoords = function(wgs84){
    var coords = undefined;
    var features = this.getAnnotateLayer().getFeaturesByAttribute(
        'id', Map.ANNOTATE_POSITION_ATTR);

    if(features.length > 0){
        var geom = features[0].geometry;
        coords = new OpenLayers.LonLat(geom.x, geom.y);
        if(wgs84){
            coords = toWGS84(coords);
        }

        // give the annotation altitude the altitude of the user
        // see https://redmine.edina.ac.uk/issues/5497
        coords.gpsPosition = this.userLonLat.gpsPosition;
    }

    return coords;
};

/**
 * The layer with the draggable icon.
 */
Map.prototype.getAnnotateLayer = function(){
    return this.getLayer('annotationMarker');
};

/**
 * @return Annotations vector layer.
 */
Map.prototype.getAnnotationsLayer = function(){
    return this.getLayer('annotationsWMS');
};

/**
 * Get the current centre and zoom level of the map.
 * @param wgs84 In WGS84?
 * @returns:
 * {Object} Object with two properties: centre and zoom level.
 */
Map.prototype.getCentre = function(wgs84){
    var centre = this.map.getCenter();

    if(wgs84){
        centre = toWGS84(centre);
    }

    return {
        centre: centre,
        zoom: this.map.getZoom(),
    }
};

/**
 * Given tile at centre of map.
 * Returns:
 * {Object} Object with the following properties: tile ({<OpenLayers.Tile>}),
 *     i ({Number} x-pixel offset from top left), and j ({Integer} y-pixel
 *     offset from top left).
 */
Map.prototype.getCentreTile = function(){
    return this.getBaseLayer().getTileData(this.map.getCenter());
};

/**
 * @return Current map extent ({<OpenLayers.Bounds>}).
 */
Map.prototype.getExtent = function(){
    return this.map.getExtent();
};

/**
 * @return The coordinates of the user, in wgs84, based on the position of the
 * user icon. ({<OpenLayers.LonLat>}).
 */
Map.prototype.getLocateCoords = function(){
    var geom = this.getLocateLayer().getFeaturesByAttribute(
        'id', Map.USER_POSITION_ATTR)[0].geometry;

    return toWGS84(new OpenLayers.LonLat(geom.x, geom.y));
};

/**
 * @return The coordinates of the user, based on the last geolocate.
 * ({<OpenLayers.LonLat>})
 */
Map.prototype.getUserCoords = function(){
    return this.userLonLat;
};

/**
 * @return User's position vector layer ({<OpenLayers.Layer>}).
 */
Map.prototype.getLocateLayer = function(){
    return this.getLayer('locate');
};

/**
 * @return Map base layer ({<OpenLayers.Layer>}).
 */
Map.prototype.getBaseLayer = function(){
    return this.map.baseLayer;
};

/**
 * @return Base vector layer for digimap closed ({<OpenLayers.Layer>}).
 */
Map.prototype.getClosedBaseLayer = function(){
    return this.getLayer('osClosed');
};

/**
 * @return Base vector layer for digimap open ({<OpenLayers.Layer>}).
 */
Map.prototype.getOpenBaseLayer = function(){
    return this.getLayer('osOpen');
};

/**
 * @param layerName
 * @return An openlayers layer by name ({<OpenLayers.Layer>}).
 */
Map.prototype.getLayer = function(layerName){
    var layer = this.map.getLayersByName(layerName);

    if(layer){
        return layer[0];
    }
    else{
        return;
    }
};

/**
 * The following hack was introduced after failing to get resolutions and
 * serverResolutions working switching between open and closed TMS layers.
 * @return Number of zoom levels of base layer.
 */
Map.prototype.getNumZoomLevels = function(){
    if(this.getOpenBaseLayer().visibility){
        return Map.RESOLUTIONS.length;
    }
    else{
        return this.getClosedBaseLayer().resolutions.length;
    }
};

/**
 * @return Layer that displays current saved maps.
 */
Map.prototype.getSavedMapsLayer = function(){
    return this.getLayer('savedMaps');
};

/**
 * @return Layer that displays a current GPS track.
 */
Map.prototype.getGPSTrackLayer = function(){
    return this.getLayer('gpsTrack');
};

/**
 * @return The tile file type of the base layer.
 */
Map.prototype.getTileFileType = function(){
    return this.getBaseLayer().type;
};

/**
 * @return The map tileset capabilities object.
 */
Map.prototype.getTileMapCapabilities = function(){
    return this.tileMapCapabilities;
};

/**
 * @return Base stack type.
 */
Map.prototype.getStackType = function(){
    return this.getTileMapCapabilities()['stack'];
};

/**
 * @return Zoom level details.
 */
Map.prototype.getZoomLevels = function(layerName){
    return {
        current: this.map.getZoom(),
        max: this.map.getNumZoomLevels() - 1
    }
};

/**
 * Hide annotation layer.
 */
Map.prototype.hideAnnotateLayer = function(){
    this.getAnnotateLayer().setVisibility(false);
};

/**
 * Remove all annotations / records from map.
 */
Map.prototype.hideAnnotationsLayer = function(){
    this.getAnnotationsLayer().setVisibility(false);

    $.each(this.map.layers, function(i, layer){
        // GPS tracks are on a seperate layer beginning with 'gps-track-'
        if(layer.name.substr(0, 10) === 'gps-track-'){
            layer.setVisibility(false);
        }
    });
};

/**
 * Hide save maps extent layer.
 */
Map.prototype.hideSavedMapsLayer = function(){
    this.getSavedMapsLayer().setVisibility(false);
};

/**
 * Receive a new user position.
 * @param position The GPS position http://docs.phonegap.com/en/2.1.0/cordova_geolocation_geolocation.md.html#Position.
 * @param updateAnnotateLayer Should annotate layer be updated after position
 * success?
 */
Map.prototype.onPositionSuccess = function(position, updateAnnotateLayer, dontHideLoadingDialog){
    this.userLonLat = new OpenLayers.LonLat(
        position.coords.longitude,
        position.coords.latitude);
    this.userLonLat.gpsPosition = position.coords;

    if(position.coords.heading){
        if(this.getLocateLayer().features.length > 0){
            // set rotation to heading direction, doesn't work opn most android
            // devices, see http://devel.edina.ac.uk:7775/issues/4852
            this.getLocateLayer().features[0].attributes.imageRotation =
                360 - position.coords.heading;
        }
    }

    // update user position
    this.updateLocateLayer();

    // if necessary update annotate pin
    if(updateAnnotateLayer){
        this.updateAnnotateLayer(toNationalGrid(this.userLonLat));
    }
    if(dontHideLoadingDialog !== true){
        $.mobile.hidePageLoadingMsg();
    }
};

/**
 * Register an object and function to recieve map zoom change updates.
 * @param obj
 * @param func
 */
Map.prototype.registerZoom = function(obj, func){
    this.map.events.register('zoomend', obj, func);
};

/**
 * Centre map with zoom level.
 * @param lon
 * @param lat
 * @param zoom
 * @param wgs84
 */
Map.prototype.setCentre = function(lon, lat, zoom, wgs84){
    var lonlat;
    if(wgs84){
        lonlat = toNationalGrid(new OpenLayers.LonLat(lon, lat));
    }
    else{
        lonlat = new OpenLayers.LonLat(lon, lat);
    }

    if(!zoom){
        zoom = this.map.getZoom();
    }

    this.map.setCenter(lonlat, zoom);
};

/**
 * Set centre of the map with a poi object.
 * @param poi Point of interest object.
 */
Map.prototype.setCentrePoi = function(poi){
    this.setCentre(poi.centre.lon, poi.centre.lat, poi.zoom);
}

/**
 * Set centre of the map with a comma separated lon lat string
 */
Map.prototype.setCentreStr = function(lonLatStr, zoom, wgs84){
    var lonLat = lonLatStr.split(',');
    this.setCentre(lonLat[0], lonLat[1], zoom, wgs84);
};

/**
 * Display all annotations on speficied layer.
 * @param layer The layer to use.
 */
Map.prototype.showAnnotations = function(layer){
    var features = [];

    //Utils.printObj(this.storage.getSavedAnnotations());

    $.each(this.storage.getSavedAnnotations(), function(id, annotation){
        var record = annotation.record;
        if(record.point !== undefined){
            features.push(new OpenLayers.Feature.Vector(
                new OpenLayers.Geometry.Point(record.point.lon,
                                              record.point.lat),
                {
                    'id': id,
                    'type': getEditorId(annotation)
                }
            ));
        }
        else{
            console.debug("record " + id + " has no location");
        }
    });

    layer.addFeatures(features);
};

/**
 * Display a single GPS Track.
 * @param id Annotation / record id.
 * @param track Annotation / record object.
 */
Map.prototype.showGPSTrack = function(id, track){
    // prepend layer name with gps-track
    var name = "gps-track-" + id;

    var layer = this.getLayer(name);
    if(layer){
        // its possible for different tracks to have the same name so remove
        // layer existing layer and replace it with current
        this.map.removeLayer(layer);
    }

    // TODO:
    // track URL found in the second element of the fields array in the
    // record, this may not always be the case
    var trackField = track.record.fields[1];

    var colour = 'red';
    if(typeof(trackField.style) !== 'undefined'){
        colour = trackField.style.strokeColor;
    }

    // create layer with the GPX track
    layer = new OpenLayers.Layer.Vector(name, {
        strategies: [new OpenLayers.Strategy.Fixed()],
        protocol: new OpenLayers.Protocol.HTTP({
            url: trackField.val,
            format: new OpenLayers.Format.GPX()
        }),
        style: {
            strokeColor: colour,
            strokeWidth: 5,
            strokeOpacity: 1
        },
        projection: Map.EXTERNAL_PROJECTION
    });

    this.map.addLayer(layer);
    layer.setVisibility(true);

    layer.events.register("loadend", this, function() {
        this.map.zoomToExtent(layer.getDataExtent());
    });
};

/**
 * Show details of a single annotation.
 * @param evt Map Click event.
 */
Map.prototype.showAnnotationDetail = function(evt){
    var feature = this.getAnnotationsLayer().getFeatureFromEvent(evt);
    if(feature){
        var annotation = this.storage.getSavedAnnotations()[feature.attributes.id];
        $(document).off('pageinit', '#annotation-details-page');
        $(document).on('pageinit', '#annotation-details-page', function(event) {
            $('#annotation-details-detail').text('');
            $('#annotation-details-header h1').text(annotation.record.name);
            var width = $('#annotation-details-page').width() / 1.17;

            $.each(annotation.record.fields, function(i, entry){
                var html;
                var type = typeFromId(entry.id);

                if(type === 'image'){
                    html = '<img src="' + entry.val + '" width="' + width + '"/>';
                }
                else if(type === 'audio'){
                    html = audioNode(entry.val, entry.label + ':');
                }
                else if(entry.id !== 'text0'){ // ignore title element
                    html = '<p><span>' + entry.label + '</span>: ' +
                        entry.val + '</p>';
                }

                $('#annotation-details-detail').append(html).trigger('create');
            });
        });

        if(feature.attributes.type === 'track'){
            this.showGPSTrack(feature.attributes.id, annotation);
        }
        else{
            $.mobile.changePage('dialog.html', {role: "dialog"});
        }
    }
};

/**
 * Attach a preview of the map onto a defined div.
 * options:
 * @param name The name of the preview.
 * @param div The div to attach the preview.
 * @param zoom Preview zoom level.
 */
Map.prototype.showMapPreview = function(options){
    var pMap;
    if(typeof(this.previews[options.name]) === 'undefined'){
        pMap = new OpenLayers.Map(
            options.div,
            {
                controls: [],
                projection: Map.INTERNAL_PROJECTION,
                units: this.map.units,
                resolutions: Map.RESOLUTIONS,
                maxExtent: this.map.maxExtent
            }
        );

        var layer = new OpenLayers.Layer.TMS(
            "os",
            this.map.baseLayer.url,
            {
                layername: this.map.baseLayer.layername,
                type: this.map.baseLayer.type
            }
        );

        pMap.addLayer(layer);
        this.previews[options.name] = pMap;
    }
    else{
        pMap = this.previews[options.name];
    }

    pMap.zoomTo(options.zoom);
    pMap.setCenter(this.getCentre().centre);

    return pMap;
};

/**
 * Render the map to a specific div.
 * @param div The div to render the map to.
 */
Map.prototype.render = function(div){
    this.map.render(div);
};

/**
 * Update map size after dynamic change in map size.
 */
Map.prototype.updateSize = function(){
    this.map.updateSize();
};

/**
 * Switch base layers.
 * @param url The new base map user.
 */
Map.prototype.switchBaseLayer = function(url){
    if(url === undefined){
        url = Utils.getMapServerUrl();
    }
    url += Map.TMS_URL;


    if(this.map.baseLayer !== null){
        if(url === this.map.baseLayer.url){
            return;
        }

        this.map.removeLayer(this.map.baseLayer);
    }

    console.debug("switch to base layer to " + url);
    var baseLayer = new MapWithLocalStorage({
        name: 'osOpen',
        db: this.storage,
        url: url,
        layerName: 'fieldtripgb@BNG',
        type: 'jpg',
        isBaseLayer: true,
        serviceVersion: this.serviceVersion,
    });

    baseLayer.setVisibility(false);
    this.map.addLayer(baseLayer);
    this.map.setBaseLayer(baseLayer);

    this.fetchCapabilities();


    this.postLocateZoomTo = Map.POST_LOCATE_ZOOM_TO_OPEN;

    // make sure switching to closed doesn't leave
    // the user at a zoom level that is not available
    if(this.map.getZoom() > Map.POST_LOCATE_ZOOM_TO_OPEN){
        this.map.setCenter(this.userLonLat, this.postLocateZoomTo);
    }
};

/**
 * Sledgehammer approach to refreshing annotations.
 * @param annotation The annotation to centre on.
 */
Map.prototype.refreshAnnotations = function(annotation){
    this.getAnnotationsLayer().removeAllFeatures();
    this.showAnnotationsLayer(annotation);
};

/**
 * Display annotate layer.
 */
Map.prototype.showAnnotateLayer = function(annotation){
    this.getAnnotateLayer().setVisibility(false);
};

/**
 * Display annotations layer.
 */
Map.prototype.showAnnotationsLayer = function(annotation){
    var layer = this.getAnnotationsLayer();
    if(layer.features.length === 0){
        this.showAnnotations(layer);
    }

    if(annotation){
        this.setCentre(annotation.record.point.lon,
                       annotation.record.point.lat,
                       undefined,
                       false);
    }

    layer.setVisibility(true);
    layer.refresh();
};

/**
 * Show saved map layer and centre on previously saved map.
 * @param details Saved map details.
 */
Map.prototype.showSavedMaps = function(details){
    var layer = this.getSavedMapsLayer();

    layer.removeAllFeatures();
    layer.setVisibility(true);

    var geom = new OpenLayers.Bounds(details.bounds.left,
                                     details.bounds.bottom,
                                     details.bounds.right,
                                     details.bounds.top).toGeometry();

    layer.addFeatures([new OpenLayers.Feature.Vector(geom)]);
    layer.redraw();

    this.setCentre(details.poi.centre.lon, details.poi.centre.lat, details.poi.zoom);
    this.map.zoomTo(this.map.getZoom() - 2);
};

/**
 * Enable / disable the map compass.
 * @param show True to show, false to hide.
 */
Map.prototype.showCompass = function(show){
    if(typeof navigator.compass !== "undefined"){
        if(show){
            $(UI.MAP_COMPASS_ID).show();
            this.compassWatchID = navigator.compass.watchHeading(
                function(heading){
                    $(UI.MAP_COMPASS_ID + ' img').css({'-webkit-transform': 'rotate(' + (360 - heading.magneticHeading) + 'deg)'});
                },
                function(error){
                    console.error('Compass error: ' + error.code);
                },
                {frequency: 2000});
        }
        else{
            navigator.compass.clearWatch(this.compassWatchID);
            $(UI.MAP_COMPASS_ID).hide();
        }
    }
};

/**
 * Switch annotations layer on/off.
 */
Map.prototype.toggleAnnotationsLayer = function(){
    var layer = this.getAnnotationsLayer();

    layer.setVisibility(!layer.visibility);

    if(layer.visibility){
        this.showAnnotations(layer);
    }
    else{
        layer.redraw();
    }
};

/**
 * Enable annotate layer.
 * @param lonlat The position (in national grid) of the annotation icon, if
 * undefined use the centre of the map.
 */
Map.prototype.updateAnnotateLayer = function(lonlat){
    if(lonlat === undefined){
        lonlat = this.map.getCenter();
    }

    this.updateLayer(this.getAnnotateLayer(),
                     Map.ANNOTATE_POSITION_ATTR,
                     undefined,
                     lonlat);
};

/**
 * Update locate layer with users geo location.
 */
Map.prototype.updateLocateLayer = function(){
    var zoom = this.map.getZoom();
    if(zoom < Map.MIN_LOCATE_ZOOM_TO){
        zoom = this.postLocateZoomTo;
    }

    this.updateLayer(this.getLocateLayer(), Map.USER_POSITION_ATTR, zoom);
};

/**
 * Update a vector layer centred on users location.
 * @param layer The layer to update.
 * @id The id of the user icon feature.
 * @zoom The map zoom level to zoom to.
 * @lonLat The current location of the user.
 */
Map.prototype.updateLayer = function(layer, id, zoom, lonLat){
    var annotationFeature = layer.getFeaturesByAttribute('id', id);

    if(lonLat === undefined || lonLat === null){
        // by default centre on user
        lonLat = toNationalGrid(this.userLonLat);
    }

    var point = new OpenLayers.Geometry.Point(lonLat.lon, lonLat.lat);
    var v = new OpenLayers.Feature.Vector(point,
                                          {'id': id}
                                         );

    if(lonLat.gpsPosition){
        point.gpsPosition = lonLat.gpsPosition;
    }


    if(annotationFeature.length === 0){
        annotationFeature = [v];
       layer.addFeatures(annotationFeature);
    } else {
        annotationFeature[0].move(lonLat);
    }

    layer.setVisibility(true);
    layer.redraw();

    this.map.setCenter(lonLat, zoom);
}

/**
 * Zoom map in one level.
 */
Map.prototype.zoomIn = function(){
    this.map.zoomIn();
};

/**
 * Zoom map out one level.
 */
Map.prototype.zoomOut = function(){
    this.map.zoomOut();
};

/**
 * Map with local storage caching.
 * @params options:
 *     db             - local storage
 *     serviceVersion - TMS service version
 *     layerName      - TMS layer name
 *     type           - layer type
 *     isBaseLayer    - is this the base layer?
 *     name           - map name
 *     url            - TMS URL
 */
var MapWithLocalStorage = OpenLayers.Class(OpenLayers.Layer.TMS, {
    initialize: function(options) {
        this.storage = options.db;

        this.serviceVersion = options.serviceVersion;
        this.layername = options.layerName;
        this.type = options.type;

        // this boolean determines which overriden method is called getURLasync
        // or getURL. Using getURLasync was causing the application to freeze,
        // often getting a ANR
        this.async = typeof(webdb) !== 'undefined';

        this.isBaseLayer = options.isBaseLayer;


        // doesn't work in 2.12
        //this.projection = Map.INTERNAL_PROJECTION.getCode();

        OpenLayers.Layer.TMS.prototype.initialize.apply(this, [options.name,
                                                               options.url,
                                                               {}]
                                                       );
    },
    getURLasync: function(bounds, callback, scope) {
        var url = OpenLayers.Layer.TMS.prototype.getURL.apply(this, [bounds]);



        var urlData = this.getUrlWithXYZ(bounds);
        //console.log("URLDATA " + urlData);
        webdb.getCachedTilePath( callback, scope, urlData.x, urlData.y , urlData.z, urlData.url);
        //console.log("URL ****************" + url);

    },
    getUrlWithXYZ: function(bounds){
           bounds = this.adjustBounds(bounds);
        var res = this.map.getResolution();
        var x = Math.round((bounds.left - this.tileOrigin.lon) / (res * this.tileSize.w));
        var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
        var z = this.serverResolutions != null ?
            OpenLayers.Util.indexOf(this.serverResolutions, res) :
            this.map.getZoom() + this.zoomOffset;
        //console.log("xxx "+ x + " yyyy " +y+ "zzzzz" + z)
        var path = this.serviceVersion + "/" + this.layername + "/" + z + "/" + x + "/" + y + "." + this.type;
        var url = this.url;
        if (OpenLayers.Util.isArray(url)) {
            url = this.selectUrl(path, url);
        }
        return { url: url + path, x:x, y:y, z:z};

    },
    getURL: function(bounds) {
        return OpenLayers.Layer.TMS.prototype.getURL.apply(this, [bounds]);
    },
});

/**
 * Use unlock for map searches.
 * @param options
 *     isMobileApp - is this being run within a native app?
 */
var MapSearch = function(options) {
    this.map = options.map;

    if(options.isMobileApp){
        this.unlockUrl = 'http://unlock.edina.ac.uk/ws/search';
    }
    else{
        this.unlockUrl = '/unlock/ws/search';
    }
};

/**
 * Kick off auto complete.
 */
MapSearch.prototype.autocomplete = function(){
    if(this.timer){
        clearTimeout(this.timer);
    }

    this.timer = setTimeout($.proxy(this.perform, this), 500);
};

/**
 * Perform search based on user input
 */
MapSearch.prototype.perform = function(){
    $('#search-spinner').show();

    if(this.searchQuery){
        this.searchQuery.abort();
    }

    this.searchQuery = $.getJSON(
        this.unlockUrl,
        {
            name: $('#searchterm').val() + '*',
            gazetteer: 'os',
            maxRows: '10',
            format: 'json'
        },
        $.proxy(function(data){
            this.searchQuery = undefined; // prevent aborting
            $('#search-results').html('');
            var uniqueList = {};
            $.each(data.features, function(i, feature){
                var name = feature.properties.name;
                if(feature.properties.adminlevel2){
                    name += ', ' + $.trim(feature.properties.adminlevel2);
                }

                if(!uniqueList[name]){
                    uniqueList[name] = true;
                    var html = '<li class="search-result-entry"><a href="#">' + name +
                        '</a><input type="hidden" value="' + feature.properties.centroid + '" /></li>';
                    $('#search-results').append(html);
                }
            });

            if($('#search-results li').length > 0){
                $('#search-results').append('<br>');
                $('#search-results').listview("refresh");

                $('.search-result-entry').click($.proxy(function(event) {
                    // entry selected, centre map
                    this.centreOnPlace($(event.currentTarget));
                }, this));
            }

            $('#search-spinner').hide();

        }, this)
    ).error(function(error) {
        console.warn("Problem fetching unlock json");
        $('#search-spinner').hide();
    });
};

/**
 * Complete search by centering on map and closing dialog.
 * @paran obj Target element.
 */
MapSearch.prototype.centreOnPlace = function(obj){
    var centre = $(obj).find('input').val();

    // undefined will keep at same zoom level
    this.map.setCentreStr(centre, undefined, true);

    // don't centre map on annotation
    this.map.storage.set('ignore-centre-on-annotation', true);
    // close dialog
    $('#search-page-close').click();
};

/**
 * Read only line feature iterator, for abstraction and access to openlayers line
 * features.
 * @param layer Vector to layer to abstract.
 * @param index of the line feature in the layer.
 */
var LineFeatureIterator = function(layer, index) {
    this.layer = layer;
    this.index = index;
};

/**
 * @return Number of point in the line.
 */
LineFeatureIterator.prototype.length = function(){
    return this.layer.features[this.index].geometry.components.length;
};

/**
 * Feature point at given index.
 * @param i Index.
 * @return Point object at index.
 */
LineFeatureIterator.prototype.get = function(i){
    var feature = this.layer.features[this.index];
    var point = toWGS84(feature.geometry.components[i]);
    return {
        'lon': point.x,
        'lat': point.y
    }
};

/**
 * Covert a nation grid point object to WGS84.
 * @param point A national grid point object.
 */
function pointToWGS84(point){
    var lonLat = toWGS84(new OpenLayers.LonLat(point.lon, point.lat));
    point.lon = lonLat.lon;
    point.lat = lonLat.lat;
};

/**
 * Covert a nation grid point object to WGS84.
 * @param point A national grid point object.
 */
function pointToNationalGrid(point){
    var lonLat = toNationalGrid(new OpenLayers.LonLat(point.lon, point.lat));
    point.lon = lonLat.lon;
    point.lat = lonLat.lat;
};

/**
 * Reproject a wgs84 latlon to national grid. A clone is created so that the
 * original lonlat is not modified. The original gps position object is copied
 * unprojected to clone.
 * @param lonlat The lonlat to convert.
 * @param lonlat in national grid.
 */
function toNationalGrid(lonlat){
    var clone = lonlat.clone();
    clone.transform(
        Map.EXTERNAL_PROJECTION,   // transform from WGS 1984
        Map.INTERNAL_PROJECTION); // to national grid Projection

    if(typeof(clone.gpsPosition) !== 'undefined'){
        clone.gpsPosition = lonlat.gpsPosition;
    }

    return clone;
};

/**
 * Reproject a national grid latlon to wgs84.
 * @param lonlat Nation grid lonlat.
 * @return WGS84 lonlat
 */
function toWGS84(lonlat){
    return lonlat.clone().transform(
        Map.INTERNAL_PROJECTION, // from national grid
        Map.EXTERNAL_PROJECTION); // to WGS 1984
};
