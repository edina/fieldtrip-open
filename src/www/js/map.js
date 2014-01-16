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

define(['ext/openlayers', 'records', 'utils'],function(ol, records, utils){

    var DEFAULT_USER_LON = -2.421976;
    var DEFAULT_USER_LAT = 53.825564;

    /**
     * Display all annotations on speficied layer.
     * @param layer The layer to use.
     */
    var showAnnotations = function(layer){
        var features = [];

        //Utils.printObj(records.getSavedrecords());

        $.each(records.getSavedRecords(), function(id, annotation){
            var record = annotation.record;
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
    };

var _this = {

    /**
     * @return layer with the draggable icon.
     */
    getAnnotateLayer: function(){
        return this.getLayer('positionMarker');
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
     * @return Records vector layer.
     */
    getRecordsLayer: function(){
        return this.getLayer('recordsLayer');
    },

    /**
     * Set up openlayer map.
     */
    init: function(){
        this.map = new OpenLayers.Map("map");
        this.map.addLayer(new OpenLayers.Layer.OSM());

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

        // add layers to map
        this.map.addLayers([positionMarkerLayer,
                            recordsLayer,
                            locateLayer]);

        var TN = OpenLayers.Class(OpenLayers.Control.TouchNavigation, {
            defaultClick: $.proxy(this.showAnnotationDetail, this),
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

        this.map.zoomTo(2);

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
    },

    /**
     * Render the map on a defined div.
     * @param div The div id.
     */
    display: function(div){
        this.map.render(div);
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
     * TODO
     */
    showAnnotateLayer: function(annotation){
        this.getAnnotateLayer().setVisibility(false);
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
        }

        layer.setVisibility(true);
        layer.refresh();
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

};

return _this;

});
