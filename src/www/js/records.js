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

/* global Camera, cordova */

define(function(require) {
    // Require modules in simplified CommonJS wrapping
    var utils = require('utils');
    var file = require('file');
    var _ = require('underscore');
    var widgets = require('widgets');
    var convert = require('convert');

    var recrowtemplate = require('text!templates/saved-records-list-template.html');
    var cameraTemplate = require('text!templates/camera-capture-template.html');

    var DOCUMENTS_SCHEME_PREFIX = "cdvfile://localhost/persistent";
    var EDITOR_CLASS = 'editor-class';
    var EDITOR_GROUP = {
        DEFAULT: 'default', // Embedded editor in the app
        PUBLIC:  'public',   // Public editors
        PRIVATE: 'private'  // Editors of an authenticated user
    };
    var IMAGE_TYPE_NAME = 'image';
    var MULTIIMAGE_TYPE_NAME = 'multiimage';
    var AUDIO_TYPE_NAME = 'audio';

    var assetsDir;

    var editorDirectories = {};
    editorDirectories[EDITOR_GROUP.DEFAULT] = 'editors/';

    var assetDirectories = {};
    var assetTypes = [];

    // Array of functions that'll process the editor
    var processEditorPipeline = [];

    // The html of the editor will pass through this functions after being displayed
    var displayEditorPipeline = [];

    var EDITORS_METADATA = 'editors-metadata';

    if(utils.isMobileDevice()){
        // create directory structure for annotation assets
        file.createDir({
            'name': 'assets',
            'success': function(dir){
                assetsDir = dir;

                _this.addAssetType(IMAGE_TYPE_NAME);
                _this.addAssetType(MULTIIMAGE_TYPE_NAME);
                _this.addAssetType(AUDIO_TYPE_NAME);
            }
        });

        // create directory structure for editors
        file.createDir({
            'name': 'editors',
            'success': function(dir){
                file.createDir({
                    'parent': dir,
                    'name' : 'private',
                    'success': function(privateDir){
                        editorDirectories[EDITOR_GROUP.PRIVATE] = privateDir;
                    }
                });
                file.createDir({
                    'parent': dir,
                    'name' : 'public',
                    'success': function(publicDir){
                        editorDirectories[EDITOR_GROUP.PUBLIC] = publicDir;
                    }
                });
            }
        });
    }

    /**
     * Capture error alert.
     * @param error Cordova error. If user cancels this will be undefined.
     */
    var captureError = function(error){
        /* global CaptureError */

        if(error !== undefined && error.code !== undefined){
            var debugMsg = "Problem with capture: " + error.code + " : ";
            var msg;
            switch(error.code){
            case CaptureError.CAPTURE_INTERNAL_ERR:
                msg = "Internal Error.";
                break;
            case CaptureError.CAPTURE_APPLICATION_BUSY:
                msg = "Application busy.";
                break;
            case CaptureError.CAPTURE_INVALID_ARGUMENT:
                msg = "Invalid Argument.";
                break;
            case CaptureError.CAPTURE_NO_MEDIA_FILES:
                msg = "No media captured";
                break;
            case CaptureError.CAPTURE_NOT_SUPPORTED:
                msg = "Not supported.";
                break;
            default:
                msg = "Unknown Error.";
            }
            console.debug(debugMsg + msg);
            utils.inform(msg);
        }
        else{
            console.debug("Capture error is undefined. Assume user cancelled.");
        }
    };

    /**
     * Create HTML editor button.
     * @param index
     * @param group Editor group, see EDITOR_GROUP.
     * @param editor Editor name.
     */
    var editorToHTML = function(index, group, editor){

        var blocks = ['a', 'b', 'c', 'd', 'e'];
        var html = '<div class="ui-block-' + blocks[index % 5] + '">\
                      <a class="' + editor['class'] + '" \
                        data-editor-type="' + editor.type +'"\
                        data-editor-group="'+ editor.group +'"\
                        href="#">\
                        <img src="css/images/custom-'+group+'.png"> \
                      </a>\
                      <p>' + editor.title + '</p>\
                    </div>';

        return html;
    };

    /**
     * Parse a rule and returne its three components
     *
     * @params {String} rule A triplet with this structure 'fieldname operation value'
     * @returns {Object} the parsed rule as or null if is not valid
     *     - field {String} the name of the field
     *     - comparator {function} a function that represents the operation
     *     - value {String} the parsed value
     */
    var parseRule = function(rule) {
        var field, operations, operation, value, comparator, matches;
        var fieldRegExp, opsRegExp, valueRegExp, ruleRegExp;

        operations = {
            equal: function(a, b) { return a === b; },
            notEqual: function(a, b) { return a !== b; },
            greaterThan: function(a, b) { return Number(a) > Number(b); },
            smallerThan: function(a, b) { return Number(a) < Number(b); }
        };

        // Define the parts of the rule
        fieldRegExp = '(.*)';
        opsRegExp = '((?:' + _(operations).keys().join(')|(?:') + '))';
        valueRegExp = '(?:\'(.*)\')';

        // Match the three parts of the rule separated by one or more spaces
        ruleRegExp = fieldRegExp + '\\s+' + opsRegExp + '\\s+' + valueRegExp;
        matches = (new RegExp(ruleRegExp)).exec(rule);

        if (matches && matches.length === 4) {
            field = matches[1];
            operation = matches[2];
            value = matches[3];
        }
        else {
            console.warn('Malformed rule: ' + rule);
            return null;
        }

        if (operations.hasOwnProperty(operation)) {
            comparator = operations[operation];
        }
        else {
            console.warn('Invalid operation: ' + operation);
            return null;
        }

        return {
            field: field,
            comparator: comparator,
            value: value
        };
    };

    var restorePersistentValues = function(form, group, type) {
        var persistentValues = _this.getPersistentValues(group, type);
        var extractFieldType = /^(.*?)-[0-9]+/;

        persistentValues.forEach(function(field) {
            var fieldType = extractFieldType.exec(field.id)[1];
            var $field = $('#fieldcontain-' + field.id, form);

            switch (fieldType) {
                case 'text':
                    $('input[type="text"]', $field).val(field.val);
                    break;
                case 'range':
                    $('input[type="range"]', $field).attr('value', field.val);
                    break;
                case 'textarea':
                    $(fieldType, $field).val(field.val);
                    break;
                case 'checkbox':
                    var values = field.val.split(',');
                    $('fieldset > input', $field).filter(function() {
                        return values.indexOf($(this).val()) > -1;
                    }).prop('checked', true);
                    break;
                case 'radio':
                    $('fieldset > input', $field).filter(function() {
                        return $(this).val() == field.val;
                    }).prop('checked', true);
                    break;
                case 'select':
                    $('select > option', $field).filter(function() {
                        return $(this).val() == field.val;
                    }).prop('selected', true);
                    break;
                default:
                    console.debug('Invalid persistent field: ' + fieldType);
            }
        });
    };

    /**
     * Start the edition of an input throught its label
     *
     * @param {String} element input selector
     * @param {String} the context where to find the element in the DOM
     * @returns {jQueryObject} the input inserted in the label
     */
    var startLabelEdition = function(element, context) {
        var $element = $(element, context);
        var $label = $('label[for=' + $element .attr('id') + ']', context);
        var $labelEditable = $label.find('input');
        var value;

        if ($labelEditable.length === 0) {
            value = $label.text();
            $labelEditable = $('<input type="text" value="' + value + '" placeholder="Other"/>');
            $label.html($labelEditable);
            $labelEditable
                .on('input', function() {
                    $element.val($(this).val());
                })
                .on('blur', function() {
                    stopLabelEdition(element, context);
                });
        }

        return $labelEditable;
    };

    /**
     * Stops the edition an input throught its label
     *
     * @param {String} element selector
     * @param {String} the context where to find the element in the DOM
     * @returns {jQueryObject} the label
     */
    var stopLabelEdition = function(element, context) {
        var $element = $(element, context);
        var $label = $('label[for=' + $element .attr('id') + ']', context);
        var $labelEditable = $label.find('input');
        var value;

        if ($labelEditable.length > 0) {
            value = $labelEditable.val() || 'Other';
            $label.html(value);
        }

        return $label;
    };

    /************************** public interface  ******************************/
var _this = {};

var _base = {
    SAVED_RECORDS_KEY: 'saved-annotations',
    IMAGE_UPLOAD_SIZE: "imageUploadSize",
    IMAGE_SIZE_NORMAL: "imageSizeNormal",
    IMAGE_SIZE_FULL: "imageSizeFull",
    EDITOR_GROUP: EDITOR_GROUP,

    /**
     * Hide records on map event name.
     */
    EVT_DELETE_ANNOTATION: 'evt-delete-annotation',

    /**
     * Event fired when editor is downloaded.
     */
    EVT_DOWNLOAD_EDITOR: 'evt-download-editor',

    /**
     * Edit record format.
     */
    EVT_EDIT_ANNOTATION: 'evt-edit-annotation',

    /**
     * Move marker on map
     */
    EVT_MOVE_ANNOTATION: 'evt-move-annotation',

    /**
     * Photo has been taken event.
     */
    EVT_TAKE_PHOTO: 'evt-take-photo',

    /**
     * Initialise annotate page.
     * @param group group that owns the editor (default: EDITOR_GROUP.DEFAULT)
     * @param type editor type
     * @param callback Function to be invoked when editor has been loaded.
     */
    initPage: function(group, type, callback) {
        group = group || EDITOR_GROUP.DEFAULT;

        var url;
        var that = this;

        if(group ===  EDITOR_GROUP.DEFAULT){
            url = 'editors/' + type;
        }
        else{
            url = file.appendFile(editorDirectories[group], type);
        }

        // convert json contained within file to HTML string
        var promise = convert.json2html(url, type);
        promise.done(function(data) {
            var form = $('#annotate-form').append(data);
            $.each($('input[capture=camera]'), function(index, input){
                var fieldType = that.typeFromId($(input).parents().parents().attr("id"));
                $(input).parent().append(that.renderCameraExtras(index, fieldType, cameraTemplate));
            });
            $.each($('input[capture=microphone]'), function(index, input){
                var btn = '<div id="annotate-audio-' + index + '">\
<a class="annotate-audio" href="#">\
<img src="css/images/audio.png" alt="Take Audio"></a><p>Start</p>\
</div>';

                $(input).parent().append(btn);
            });
            $.each($('input[capture=gps]'), function(index, input){
                var btn = '<div id="annotate-gps-' + index + '">\
<a class="annotate-image-get" href="#">\
<img src="css/images/audio.png"></a><p>Take</p>\
</div>';

                $(input).parent().append(btn);
            });

            var imageTypeOptions = ["checkbox", "radio"];
            //replace labels with actual images that are part of the editor
            $.each(imageTypeOptions, function(index, type) {
                $.each($('input[type="'+type+'"]'), function(){
                    var $prev = $(this).prev();
                    var $img = $prev.find('img');
                    if($img.is('img')){
                        var elementValue = $img.attr("src");
                        $img.attr("src", utils.getFilename(url)+'/'+elementValue).css("width", "100%");
                        $img.on('load', function(){
                            $prev.find('p').height($(this).height());
                        });
                    }
                });
            });

            // Allow the edition of 'Other' label for radio fieldsets
            $('fieldset', 'div[id^=fieldcontain-radio]').on('change', function() {
                var $this = $(this);
                var $selected = $this.find('input:checked');

                if ($selected.hasClass('other')) {
                    startLabelEdition($selected, $this).focus();
                }
                else {
                    stopLabelEdition('input.other', $this);
                }
            });

            // Allow the edition of 'Other' label for radio fieldsets
            $('fieldset', 'div[id^=fieldcontain-checkbox]').on('change', function(event) {
                var $this = $(this);
                var $selected = $(event.target);

                if ($selected.hasClass('other')) {
                    startLabelEdition($selected, $this).focus();
                }
                else {
                    stopLabelEdition('input.other', $this);
                }
            });

            // Attach the event that show or hide a field according some rule
            $.each($('div[id^=fieldcontain-]'), function(index, element) {
                var $element = $(element);
                var rule = $element.attr('data-visibility');
                if (rule) {
                    var r = parseRule(rule);
                    if (r === null) {
                        return;
                    }

                    var checkVisibility = function() {
                        var $fieldset = $(this);
                        var serialized = $fieldset.serializeArray();

                        if(serialized.length > 0) {
                            if (r.comparator(serialized[0].value, r.value)) {
                                $element.show();
                                return;
                            }
                        }

                        // Default to hide
                        $element.hide();
                    };

                    $('fieldset', 'div[id^=' + r.field + ']')
                        .on('change', checkVisibility);

                    // Initialize
                    checkVisibility.apply(this);
                }
            });

            $.each($('div[id^=fieldcontain-]'), function(index, item) {
                var widgetType = $(item).data('fieldtrip-type');
                var widgetsList = widgets.getWidgets(widgetType);
                widgets.initializeWidgets(widgetsList, index, item);
            });

            restorePersistentValues(form, group, type);

            //Add bbox if exists
            var bbox = $('input[data-bbox]').data("bbox") || "";

            //Add check for geometry type capture
            var recordGeometry = $('input[data-record-geometry]').data("record-geometry") || "point";
            var liveEditorMetadata = {
                "name": type,
                "bbox": bbox.split(","),
                "geometryTypes": recordGeometry.split(",")
            };
            sessionStorage.setItem("editor-metadata", JSON.stringify(liveEditorMetadata));

            form.trigger('create');

            that.processDisplayEditor(form);

            // hide original input elements
            $('input[capture]').parent().hide();

            // TODO: chain multiple popups
            $('.warning-popup').popup('open');

            callback();
        });

        promise.fail(function(err) {
            utils.inform(err);
        });
    },

    /**
     * Create the list view with the annotations
     */
    addAnnotations: function(annotations){
        var html = '';
        var template = _.template(recrowtemplate);
        var update = false;
        var layout = localStorage.getItem('records-layout');

        for(var key in annotations){
            if(annotations.hasOwnProperty(key)){
                var annotation = annotations[key];
                if(annotation){
                    html += template({
                        "id": key,
                        "annotation": annotation,
                        "fields": annotation.record.fields,
                        "records": this,
                        "layout": layout
                    });
                }else{
                    delete annotations[key];
                    update = true;
                }
            }
        }

        if(update){
            this.setSavedRecords(annotations);
        }

        $('#saved-records-list-list').append(html);
        $('#saved-records-list-list').trigger('create');
    },

    /**
     * Add an annotation to 'live' saved records page.
     * @param id annotation id.
     * @param annotation
     */
    addAnnotationToSavedRecords: function(id, annotation){
        var template = _.template(recrowtemplate);

        $('#saved-records-list-list').append(
            template({
                "id": id,
                "annotation": annotation,
                "fields": annotation.record.properties.fields,
                "records": this
            })
        ).trigger('create');
    },

    /**
     * Add a new asset type. This allows plugins to define new types of assets.
     * @param type Asset type.
     */
    addAssetType: function(type, callback) {
        assetTypes.push(type);

        if(assetsDir){
            file.createDir({
                'parent': assetsDir,
                'name': type,
                'success': function(assetDir){
                    assetDirectories[type] = assetDir;
                    utils.doCallback(callback, assetDir);
                }
            });
        }
    },

    /**
     * Add an editor
     * Read the content from a file entry and trigger the editor processing.
     * @param fileEntry a fileentry to be read
     * @param group of the editor records.EDITOR_GROUP
     * @param online optional parameter if the process is online of offline
     *               i.e. from the file system
     */
    addEditor: function(fileEntry, group, online) {
        // Set the default value
        if(online === undefined){
            online = true;
        }

        var deferred = new $.Deferred();

        console.debug('addEditor: ' + fileEntry.name + ' ' + group);
        var promise = file.readTextFile(fileEntry);

        promise.done(function(data) {
            _this.processEditor(fileEntry.name, data, group, online);

            $.event.trigger(
                {
                    type: _this.EVT_DOWNLOAD_EDITOR
                },
                [data]
            );

            deferred.resolve();
        });

        promise.fail(function(err) {
            console.error(err);
            deferred.reject();
        });

        return deferred.promise();
    },

    /**
     * Add a list of editors
     * @param entries {Array} of {FileEntry} pointing to each editor
     * @param group of the editor records.EDITOR_GROUP
     * @param online optional parameter if the process is online of offline
     * @returns a {Promise} that is resolved then the process has finished or
     *     is rejected.
     */
    addEditors: function(entries, group, online) {
        var _this = this;
        var addedEditors;
        var mapEntries;

        mapEntries = entries.map(function(entry) {
            return _this.addEditor(entry, group, online);
        });

        addedEditors =
            $.when.apply(null, mapEntries)
                .then(function() {
                    return Array.prototype.slice.call(arguments);
                });

        return addedEditors;
    },

    /**
     * Add a function to process the editor when is displayed
     * @param function name
     */
    addDisplayEditorFunction: function(funcName) {
        if (typeof funcName === 'function') {
            displayEditorPipeline.push(funcName);
        }
    },

    /**
     * Add a function to the editor process pipeline
     * @param function name
     */
    addProcessEditor: function(funcName){
        // TODO: add priority
        if(typeof(funcName) === 'function'){
            processEditorPipeline.push(funcName);
        }
    },

    /**
     * function for adding extra properties to record
     * @param record
     * @param prop is the key for the properties
     * @param value is the value for the key in properties
     * @returns record
     */
    addRecordProperty: function(record, prop, value){
        record.properties[prop] = value;
        return record;
    },

    /**
     * Annotate a record.
     * @param group Group that owns the editor
     * @param type The type of editor to annotate.
     */
    annotate: function(group, type){
        // note: obscure bug with dynamic loading of editors where the last form
        // control was grabbing focus.  This was 'fixed' by specifying a 'fade'
        // transition. see: http://devel.edina.ac.uk:7775/issues/4919

        localStorage.setItem('annotate-form-group', group);
        localStorage.setItem('annotate-form-type', type);
        $('body').pagecontainer('change', 'annotate.html', {transition: "fade"});
    },

    /**
     * Annotate an image record.
     */
    annotateImage: function(){
        this.annotate(EDITOR_GROUP.DEFAULT, 'image.edtr');
    },

    /**
     * Annotate an audio record.
     */
    annotateAudio: function(){
        this.annotate(EDITOR_GROUP.DEFAULT, 'audio.edtr');
    },

    /**
     * Annotate a text record.
     */
    annotateText: function(){
        this.annotate(EDITOR_GROUP.DEFAULT, 'text.edtr');
    },

    /**
     * Add survey/editor button to page.
     * @param group Editor group, see EDITOR_GROUP
     * @param section HTML element to attack button.
     */
    appendEditorButtons: function(group, section){
        var editors = this.getEditorsByGroup(group);
        var i = 0;
        for(var key in editors){
            if(editors.hasOwnProperty(key)){
                var editor = editors[key];
                var html = editorToHTML(i, group, editor);
                $(section).append(html);
                i++;
            }
        }
    },

    /**
     * Add survey/editor buttons to page.
     * @param section HTML element to attack button.
     */
    appendAllEditorButtons: function(){
        var section = '#capture-section2';
        var config = utils.getConfig();
        if(config.hasOwnProperty('synccaptureid')){
            section = '#' + config.synccaptureid;
        }

        $(section).empty();
        this.appendEditorButtons(EDITOR_GROUP.PRIVATE, section);
        this.appendEditorButtons(EDITOR_GROUP.PUBLIC, section);
    },

    /**
     * Delete all locally stored records.
     */
    clearSavedRecords: function(){
        localStorage.setItem(this.SAVED_RECORDS_KEY, '');
    },

    /**
     * This will convert pre 1.5 records to the new geojson record format.
     */
    convertCheck: function(){
        var newAnnotations = {};
        var currentAnnotations = this.getSavedRecords();

        if(currentAnnotations){
            // check if first record has a geometry property
            // if it doesn't then a convert is required
            var convertRequired = false;
            $.each(currentAnnotations, $.proxy(function(id, annotation){
                convertRequired = typeof(annotation.record.geometry) === 'undefined';
                return;
            }));

            if(convertRequired){
                console.debug("Convert to new record format");
                utils.printObj(currentAnnotations);

                $.each(currentAnnotations, $.proxy(function(id, oldAnnotation){
                    var oldRecord = oldAnnotation.record;
                    var newAnnotation = this.createRecord(oldRecord.editor);

                    newAnnotation.record.geometry.coordinates = [
                        oldRecord.point.lon,
                        oldRecord.point.lat
                    ];

                    newAnnotation.record.name = oldRecord.name;
                    newAnnotation.record.properties.fields = oldRecord.fields;
                    newAnnotation.record.properties.timestamp = oldRecord.timestamp;

                    newAnnotations[id] = newAnnotation;
                    newAnnotations[id].isSynced = oldAnnotation.isSynced;
                }, this));

                console.debug("--------------------------------------------------");
                utils.printObj(newAnnotations);

                this.setSavedRecords(newAnnotations);
            }
        }
    },

    /**
     * create record
     * @param type of the editor
     * @param group group that owns the editor
     * @returns record
     */
    createRecord: function(type, group){
        if(!group){
            group = EDITOR_GROUP.PRIVATE;
        }

        return {
            "record": {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": []
                },
                "properties": {
                    "editor": type,
                    "fields": []
                }
            },
            "type": type,
            "isSynced": false,
            "editorGroup": group
        };
    },

    /**
     * Delete all editor forms.
     * @returns a {Promise} that is resolved when it's done or rejected
     */
    deleteAllEditors: function() {
        var deferred = $.Deferred();

        this.initEditorsMetadata();
        // easiest way to do this is to delete the directory and recreate it
        file.deleteAllFilesFromDir(
            editorDirectories[EDITOR_GROUP.PRIVATE],
            function(dir) {
                editorDirectories[EDITOR_GROUP.PRIVATE] = dir;
                deferred.resolve(dir);
            },
            deferred.reject
        );

        return deferred.promise();
    },

    /**
     * delete annotation / record
     * @param annotation id of record to be deleted.
     */
    deleteAnnotation: function(id){
        var annotations = this.getSavedRecords();
        var annotation = annotations[id];

        if(annotation !== undefined){
            // fire delete record event, this allows plugins to clean up
            $.event.trigger(
                {
                    type: this.EVT_DELETE_ANNOTATION,
                },
                utils.clone(annotation)
            );

            // remove annotation from hash
            delete annotations[id];

            // save to local storage
            this.setSavedRecords(annotations);
        }
        else{
            console.warn("Attempted to delete record that didn't exist: " + id);
        }
    },

    /**
     * Delete annotation / record by name
     * @param annotation Name of record to be deleted.
     */
    deleteAnnotationByName: function(name){
        var id = this.getAnnotationId(name);
        if(id){
            this.deleteAnnotation(id);
        }
        else{
            console.warn("No annotation found with name: " + name);
        }

        return id;
    },

    /**
     * Delete a single editor from file system.
     * @param fileName The name of the file to delete.
     * @param callback Function will be called when editor is successfully deleted.
     */
    deleteEditor: function(group, editorName, callback){
        this.deleteFile(editorName, editorDirectories[group], function(){
            _this.removeEditorMetadata(group, editorName);
            utils.doCallback(callback);
        });
    },

    /**
     * Delete a file from file system.
     * @param fileName The name of the file to delete.
     * @param dir The directory the file belongs to.
     * @param callback Function will be called when editor is successfully deleted.
     */
    deleteFile: function(fileName, dir, callback){
        if(dir === undefined){
            dir = assetsDir;
        }
        file.deleteFile(fileName, dir, callback);
        file.deleteDirectory(dir.toURL()+"/"+fileName.substr(0, fileName.lastIndexOf(".")), callback);
    },

    /**
     * Get internal annotation id and record for a given record name. This only
     * applies to synced records.
     * @param name Record name.
     */
    getAnnotationDetails: function(name) {
        var details;
        $.each(this.getSavedRecords(), function(i, annotation){
            if(annotation.record.name.toLowerCase() === name.toLowerCase() &&
               annotation.isSynced){
                details = {
                    'id': i,
                    'annotation': annotation
                };
                return false; // breaks loop!
            }
        });

        return details;
    },

    /**
     * Get internal annotation id and record for a given record id. This only
     * applies to non synced records.
     * @param name Record id.
     */
    getAnnotationDetailsById: function(id) {
        var details;
        $.each(this.getSavedRecords(), function(i, annotation){
            if(i === id && !annotation.isSynced){
                details = {
                    'id': i,
                    'annotation': annotation
                };
                return false; // breaks loop!
            }
        });

        return details;
    },

    /**
     * Get internal annotation id for a given record name. This only applies to
     * synced records.
     * @param name Record name.
     * @param isSynced
     */
    getAnnotationId: function(name, isSynced) {
        var id;
        $.each(this.getSavedRecords(), function(i, annotation){
            // note: dropbox is case insensitive so we should be also
            if(annotation.record.name.toLowerCase() === name.toLowerCase()){
                id = i;
                if(isSynced === undefined && annotation.isSynced){
                    id = undefined;
                }
                return false; // breaks loop!
            }
        });

        return id;
    },

    /**
     * Get assets directory.
     * @param type Asset type.  If undefined will return assets root.
     * @return Assets directory object.
     */
    getAssetsDir: function(type){
        if(type){
            return assetDirectories[type];
        }
        else{
            return assetsDir;
        }
    },


    /**
     * @param group a record.EDITOR_GROUP
     * @return promise that resolves in a list of active editors for given group
     */
    getActiveEditors: function(group){
        var deferred = new $.Deferred();
        this.getEditors(group, function(files){
            var editors = [];
            for(var i = 0; i<files.length; i++){
                editors.push(files[i].name);
            }
            deferred.resolve(editors);
        });
        return deferred.promise();
    },

    /**
      * Get the list of editors from localstorage
      * @return an object with the editors
      */
    getEditors: function(){
        return this.loadEditorsMetadata();
    },

    /**
      * Get the list of editors filtered by group from localstorage
      * @param group editors group
      * @return an object with the editors
     */
    getEditorsByGroup: function(group){
        return this.getEditors()[group] || {};
    },

    /**
     * @param type optional type of editor (default: EDITOR_GROUP.PRIVATE)
     * @return Editor forms directory object.
     */
    getEditorsDir: function(group){
        // Default is private
        group = group || EDITOR_GROUP.PRIVATE;
        return editorDirectories[group];
    },

    /**
     * @param annotation Annotation record.
     * @return The editor id for a given annotation.
     */
    getEditorId: function(annotation){
        var record = annotation.record;
        return record.properties.editor.substr(0, record.properties.editor.indexOf('.'));
    },

    /**
     * Construct the object for the options of the image.
     */
    getImageOptions: function(sourceType, encodingType){
        var options = {
            quality: 100,
            destinationType: Camera.DestinationType.FILE_URI,
            sourceType : sourceType,
            encodingType: encodingType,
            correctOrientation: true
        };
        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) != this.IMAGE_SIZE_FULL){
            options.targetWidth = 640;
            options.targetHeight = 480;
        }
        return options;
    },

    /**
     * Get the persistent values associated to the editor
     * @param group Editor's group
     * @param type Editor's type
     * @returns an array of values
     */
    getPersistentValues: function(group, type) {
        var persistentValues = [];
        var editorsMetadata = _this.loadEditorsMetadata();
        if (editorsMetadata[group] && editorsMetadata[group][type] &&
            editorsMetadata[group][type].persistentValues) {
            persistentValues = editorsMetadata[group][type].persistentValues;
        }

        return persistentValues;
    },

    /**
     * get photo from local filesystem
     */
    getPhoto: function(callback) {
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                $.proxy(function(fileURI){
                    //rename filename of image from modified.jpg?timestamp to modified_timestamp.jpg
                    var name = fileURI.substr(fileURI.lastIndexOf('/') + 1);
                    if(name.indexOf('?')){
                        var splits = name.split('?');
                        var splits2 = splits[0].split('.');
                        name = splits2[0]+"_"+splits[1]+"."+splits2[1];
                    }
                    var newFileURI = fileURI.substr(0, fileURI.lastIndexOf('/')+1) + name;
                    //move image from cache folder to assets by renaming it
                    file.moveTo({
                        'path': fileURI,
                        'to': this.getAssetsDir(IMAGE_TYPE_NAME),
                        'newName': name,
                        'success': function(newEntry){
                            callback(newEntry.toURL());
                        }
                    });
                }, this),
                captureError,
                this.getImageOptions(
                    navigator.camera.PictureSourceType.SAVEDPHOTOALBUM,
                    navigator.camera.MediaType.PICTURE)
            );
        }
    },

    /**
     * @param if The annotation id.
     * @return A saved annotation from local storage.
     */
    getSavedRecord: function(id){
        return this.getSavedRecords()[id];
    },

    /**
     * Get Saved annotations/records in local storage.
     * @param filter A function for testing the conditions of the filter. If this
     * function returns true, the annotation will pass the filter and be included
     * in the saved list. The function will take an annotation object as a
     * parameter.
     * @return Object of saved annotations in local storage keyed by id.
     */
    getSavedRecords: function(filter){
        var savedAnnotations = {};
        var savedAnnotationsObj = localStorage.getItem(this.SAVED_RECORDS_KEY);

        if(savedAnnotationsObj &&
           savedAnnotationsObj.length > 0 &&
           savedAnnotationsObj != '[null]'){

            try{
                if(filter){
                    if(typeof(filter) === 'function'){
                        var annotations = JSON.parse(savedAnnotationsObj);
                        $.each(annotations, function(id, annotation){
                            if(filter(annotation)){
                                savedAnnotations[id] = annotation;
                            }
                        });
                    }
                }
                else{
                    savedAnnotations = JSON.parse(savedAnnotationsObj);
                }
            }
            catch(error){
                // somethings went wrong with save, delete contents
                console.error(error);
                localStorage.removeItem(this.SAVED_RECORDS_KEY);
            }
        }

        return savedAnnotations;
    },

    /**
     * @return Number of locally stored records/annotations.
     */
    getSavedRecordsCount: function(){
        var i = 0;
        $.each(this.getSavedRecords(), function(){
            i++;
        });

        return i;
    },

    IMAGE_TYPE_NAME: IMAGE_TYPE_NAME,

    /**
     * Initialize the editors metadata in local storage
     */
    initEditorsMetadata: function(){
        var obj = {};
        obj[EDITOR_GROUP.PUBLIC] = {};
        obj[EDITOR_GROUP.PRIVATE] = {};
        this.saveEditorsMetadata(obj);
        return obj;
    },

    /**
     * Does this record field define an asset?
     * @param field Annotation record field.
     * @param type Optional record type. If undefined it will be determined by the id.
     */
    isAsset: function(field, type){
        var isAsset = false;

        if(type === undefined){
            type = field.type;
        }

        if($.inArray(field.type, assetTypes) !== -1){
            isAsset = true;
        }

        return isAsset;
    },

    /**
     * Read the editors from the filesystem and process them
     */
    loadEditorsFromFS: function(){
        var loadEditors = function(){
            var groups = [EDITOR_GROUP.PUBLIC, EDITOR_GROUP.PRIVATE];
            $.each(groups, function(i, group){
                var directory = editorDirectories[group];
                if(directory !== undefined){
                    var directoryReader = directory.createReader();
                    directoryReader.readEntries(
                        function success(entries) {
                            $.each(entries, function(i, entry){
                                _this.addEditor(entry, group, false);
                            });
                        },
                        function fail(error) {
                            console.error("Failed to list editor directory contents: " + error.code);
                        }
                    );
                }
            });
        };

        if(utils.isMobileDevice()){
            // copy project defined form to editors directory
            var form = utils.getConfig().projectform;
            if(form && !localStorage.getItem('project-form-loaded')){
                $.get('../forms/' + form, $.proxy(function(data){
                    var promise = file.writeToFile({
                        'fileName': form,
                        'dir': this.getAssetsDir(),
                        'data': data
                    });

                    promise.done(function(){
                        localStorage.setItem('project-form-loaded', true);
                        loadEditors();
                    });

                }, this));
            }
        }
    },

    /**
     * Load the editors metadata from local storage
     * @return an object with the metadata
     */
    loadEditorsMetadata: function(){
        var str = localStorage.getItem(EDITORS_METADATA);
        var obj;
        if(str === null){
            return this.initEditorsMetadata();
        }
        try{
            obj = JSON.parse(str);
        }catch(e){
            console.warn('Invalid editors metadata reinitializing it');
            return this.initEditorsMetadata();
        }

        return obj;
    },

    /**
     * Print all records to console. By default android truncates long log
     * messages, this ensures all records are printed to log.
     */
    printRecords: function(){
        $.each(this.getSavedRecords(), function(id, record){
            console.debug('id: ' + id);
            utils.printObj(record);
        });
    },

    /**
     * Process annotation/record from an HTML5 form.
     * @param orgAnnotation existing annotation
     * @param group form group
     * @param recordType record/Form type - image, text, audio or custom
     */
    processAnnotation: function(orgAnnotation, group, recordType){
        var lastError;
        var valid = [];
        var persistentValues = [];
        var annotation = this.createRecord(recordType, group);

        if(orgAnnotation === undefined){
            annotation.record.name = $('input[data-title="true"]').val();
            if(annotation.record.name === undefined){
                annotation.record.name = $('form').attr('data-title') + '-' +
                    utils.getSimpleDate();
            }
        }
        else{
            annotation.record.name = orgAnnotation.record.name;
            annotation.record.geometry = orgAnnotation.record.geometry;
            annotation.editing = true;
        }

        $.each($('div[class=fieldcontain]'), $.proxy(function(i, entry){
            var divId = $(entry).attr('id');
            var start = divId.indexOf('-') + 1;
            var end = divId.lastIndexOf('-');
            var type = divId.substr(start, end - start);
            var control;

            var ignoreField = false;
            var field = {
                id: divId.replace("fieldcontain-", ""),
                type: type,
                val: null
            };

            var setInputValue = function(control){
                var val = $(control).val();
                if(val){
                    val = val.trim();
                }
                field.val = val;
            };

            var doInput = function(controlType){
                control = $(entry).find(controlType);
                setInputValue(control);
            };

            var doLabel = function(id){
                field.label = $(entry).find('label[for="' + id + '"]').text();
            };

            var doLegend = function(){
                field.label = $(entry).find('legend').text();
            };

            var doTextField = function(controlType){
                doInput(controlType);
                doLabel(control.attr('id'));
            };

            if(type === 'text'){
                doTextField('input');
            }
            else if(type === 'textarea'){
                doTextField(type);
            }
            else if(type === 'checkbox'){
                doLegend();
                $.each($(entry).find('input:checked'), function(j, checkbox){
                    if(field.val === null){
                        field.val = $(checkbox).val();
                    }
                    else{
                        field.val += ',' + $(checkbox).val();
                    }
                });
            }
            else if(type === 'radio'){
                var radioControl = $(entry).find('input:checked');
                field.label = $(entry).find('legend').text();
                setInputValue(radioControl);
            }
            else if(type === 'select'){
                doLegend();
                control = $(entry).find('select');
                setInputValue(control);
            }
            else if(type === 'range'){
                doTextField('input');
            }
            else if(type === 'image'){
                control = $(entry).find('input');
                var src = $(entry).find('.annotate-image img').attr('src');
                if(src){
                    field.val = src;
                }
                doLabel($(entry).find('input').attr('id'));
            }
            else if(type === 'multiimage'){
                var images = [];
                $(entry).find('.annotate-image img').each(function(){
                    images.push($(this).attr('src'));
                });
                if(images.length > 0){
                    field.val = images;
                }
                doLabel($(entry).find('input').attr('id'));
            }
            else if(type === 'audio'){
                control = $(entry).find('input[capture=microphone]');
                var value = $(entry).find('.annotate-audio-taken input').attr('value');
                if(value){
                    field.val = value;
                }
                doLabel($(control).attr('id'));
            }
            else
            {
                var widgetsList = widgets.getWidgets(type);
                var serialized;
                if (widgetsList.length > 0) {
                    serialized = widgets.serializeWidgets(widgetsList, entry);
                    // Check if it can be serialized
                    if (serialized === null) {
                        ignoreField = true;
                    }
                    else {
                        field.val = serialized.value;
                        field.repr = serialized.repr;
                        field.label = serialized.label;
                    }
                }
                else
                {
                    console.warn('No such control type: ' + type + '. div id = ' + divId);
                }
            }

            // do some validation
            if($(control).attr('required') === 'true' || $(control).attr('required') === 'required'){
                // Validate the fields
                if(field.val === null ||
                   field.val === undefined ||
                   field.val === "") {
                    $(control).addClass('error');
                    valid.push({
                        error: true,
                        msg: field.label + ' requires a value'
                    });
                    return;
                }
            }

            // Save the value for the persistent fields
            if ($(entry).data('persistent') === 'on') {
                persistentValues.push(field);
            }

            if(ignoreField === false){
                annotation.record.properties.fields.push(field);
            }
        }, this));

        if (valid.length === 0) {
            _this.setPersistentValues(group, recordType, persistentValues);

            // nasty I know: but changing page in a setTimeout allows
            // time for the keyboard to close
            setTimeout(function(){
                $('body').pagecontainer('change', 'annotate-preview.html');
            }, 300);
        }
        else {
            var delayIn = 0;
            _.each(valid, function(value) {
                utils.slideNotification(value.msg, delayIn, 3000);
                delayIn += 500;
            });
        }

        // fire edit record event, this allows plugins to edit record
        $.event.trigger(
            {
                type: this.EVT_EDIT_ANNOTATION,
            },
            annotation
        );

        return annotation;
    },

    /**
     * Interface for processing the editor
     * @param editorName name of the editor
     * @param html, html content
     * @param group from records.EDITOR_GROUP
     * @param online if the process is being held online or offline
     */
    processEditor: function(editorName, html, group, online){
        for(var i =0; i<processEditorPipeline.length; i++){
            var process = processEditorPipeline[i];
            if(typeof(process) === 'function'){
                process.apply(null, arguments);
            }
        }
    },


    /**
     * Process the editor on display
     * @param @form a jquery object containing the editor
     */
    processDisplayEditor: function($form) {
        for (var i = 0, len = displayEditorPipeline.length; i < len; i++) {
            var func = displayEditorPipeline[i];
            if (typeof func === 'function') {
                func.apply(null, arguments);
            }
        }
    },

    /**
     * Implements the records.processEditor interface
     * @param editorName name of the editor
     * @param text content of the editor
     * @param group from records.EDITOR_GROUP
     * @param online boolean value if the processing is held online
     */
    extractEditorMetadata: function(editorName, text, group, online){
        var form = JSON.parse(text);
        var editorsObj = _this.loadEditorsMetadata();
        editorsObj[group][editorName] = editorsObj[group][editorName] || {};

        if(editorsObj[group][editorName]['class'] === undefined){
            editorsObj[group][editorName]['class'] = 'annotate-custom-form';
        }

        // Add the group to the editor
        editorsObj[group][editorName].group = group;

        // Add the type of the editor
        editorsObj[group][editorName].type = editorName;

        //Add bbox if exists
        editorsObj[group][editorName].bbox = form.bbox || "";

        //Add bbox if exists
        editorsObj[group][editorName].recordGeometry = form.geom || "point";


        // Add the title wich will be displayed
        var title = form.title;
        if(title !== undefined){
            editorsObj[group][editorName].title = title;
        }else{
            var matches = editorName.match(/(.*).json$/);
            if(matches && matches.length > 1){
                editorsObj[group][editorName].title = matches[1];
            }else{
                editorsObj[group][editorName].title = editorName;
            }
        }

        _this.saveEditorsMetadata(editorsObj);
    },

    /**
     * Read a value from local storage as a JSON
     */
    readJSON: function(key) {
        var value;

        try {
            value = JSON.parse(localStorage.getItem(key));
        }
        catch (ex) {
        }

        return value;
    },

    /**
     * function for removing the metadata associated to an editor
     * @param group Record name
     * @param editorName Editor name
     */
    removeEditorMetadata: function(group, editorName){
        var editorsObj = _this.loadEditorsMetadata();
        delete editorsObj[group][editorName];
        _this.saveEditorsMetadata(editorsObj);
    },

    /**
     * function for rendering the extra options for camera on the form
     * @param index which is the id
     * @param type the type of the image (image|multiimage)
     * @param tmpl template of the buttons, it's needed as parameter because it's
     * used by other plugins
     * @returns html rendered
     */
    renderCameraExtras: function(index, type, tmpl){
        var fullSelected = '', normalSelected = '', CHECKED = 'checked';

        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) === this.IMAGE_SIZE_FULL){
            fullSelected = CHECKED;
        }
        else{
            normalSelected = CHECKED;
        }
        var template =  _.template(tmpl);
        return template({"index": index, "type": type, "fullSelected": fullSelected, "normalSelected": normalSelected});
    },

    /**
     * save annotations/record locally
     * @param annotation Record object.
     */
    saveAnnotation: function(id, annotation){
        if(annotation === undefined){
            throw "Annotation must be defined";
        }

        var savedAnnotations = this.getSavedRecords();

        if(id === undefined){
            var date = new Date();
            annotation.record.properties.timestamp = date;
            id = date.getTime().toString();
        }

        savedAnnotations[id] = annotation;
        this.setSavedRecords(savedAnnotations);

        return id;
    },

    /**
     * Save annotation with the coords currently selected.
     */
    saveAnnotationWithCoords: function(annotation, geometry){
        annotation.record.geometry = geometry;

        if(typeof(geometry.gpsPosition) !== 'undefined'){
            if (geometry.gpsPosition.altitude !== null && !geometry.markerMoved) {
                //there's a problem with OL when I add altitude
                //annotation.record.geometry.coordinates[2] = geometry.gpsPosition.altitude;
            }

            $.event.trigger(
                {
                    type: this.EVT_MOVE_ANNOTATION,
                },
                [annotation,
                geometry.markerMoved]
            );
        }
        var id = this.getAnnotationId(annotation.record.name);

        this.saveAnnotation(id, annotation);
    },

    /**
     * Serialize the editors metadata into local storage as string
     * @param obj the object representing the editor metadata
     */
    saveEditorsMetadata: function(obj){
        var str = JSON.stringify(obj);
        localStorage.setItem(EDITORS_METADATA, str);
    },

    /**
     * Set the values of the persistent values for given editor
     * @param group Editor group
     * @param type Editor name
     * @param values and array of key:val items
     */
    setPersistentValues: function(group, type, values) {
        var editorsMetadata = _this.loadEditorsMetadata();

        if (editorsMetadata[group] && editorsMetadata[group][type]) {
            editorsMetadata[group][type].persistentValues = values;
        }

        _this.saveEditorsMetadata(editorsMetadata);
    },

    /**
     * Save annotations to local storage.
     * @annotations Hash of local records.
     */
    setSavedRecords: function(annotations){
        //console.debug(JSON.stringify(annotations, undefined, 2));
        localStorage.setItem(this.SAVED_RECORDS_KEY, JSON.stringify(annotations));
    },

    /**
     * Store a value as a JSON string in localStorage
     * @param item key of the itme in
     * @param key -  the key of the item
     * @param value - the object to store
     */
    storeJSON: function(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    /**
     * Invoke the device's audio recorder
     * @param callback Function executed after successful recording.
     */
    takeAudio: function(callback){
        var that = this;
        var invokeRecorder = function(){
            if (navigator.device !== undefined){
                navigator.device.capture.captureAudio(
                    function(mediaFiles){
                        // move file to audio assets directory

                        // can't guarantee audio plugin will generate
                        // unique file name so do it ourself
                        var media = mediaFiles[0];
                        var ext = media.name.split('.')[1];
                        var name = 'audio' + $.guid + '.' + ext;

                        file.moveTo({
                            'path': media.fullPath,
                            'to': that.getAssetsDir(AUDIO_TYPE_NAME),
                            'newName': name,
                            'success': function(newEntry){
                                callback({
                                    url: newEntry.toURL(),
                                    label: name,
                                    duration: media.duration
                                });
                            }
                        });
                    },
                    captureError,
                    {limit: 1}
                );
            }
        };

        // if it's possible check if the intent has an activity associated
        if(cordova && cordova.plugins && cordova.plugins.ActivitiesList){
            cordova.plugins.ActivitiesList.byIntent(
                'android.provider.MediaStore.RECORD_SOUND',
                function(activities){
                    if(activities.length > 0){
                        invokeRecorder();
                    }
                    else{
                        $('#audiorecorder-error-popup').popup('open');
                    }
                },
                function(error){
                    console.error(error);
                }
            );

        }
        else{
            invokeRecorder();
        }
    },

    /**
     * take photo action
     */
    takePhoto: function(callback){
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                $.proxy(function(fileURI){
                    // move file to image assets directory
                    file.moveTo({
                        'path': fileURI,
                        'to': this.getAssetsDir(IMAGE_TYPE_NAME),
                        'success': $.proxy(function(newEntry){
                            $.event.trigger(
                                {
                                    type: this.EVT_TAKE_PHOTO,
                                },
                                [newEntry]
                            );
                            callback(newEntry.toURL());
                        }, this)
                    });
                }, this),
                captureError,
                this.getImageOptions(
                    Camera.PictureSourceType.CAMERA,
                    Camera.EncodingType.JPEG)
            );
        }
    },

    /**
     * Determine the form type from the div id.
     * @param id Field div id.
     * @return The control type for a field id.
     */
    typeFromId: function(id){
        var type;
        var subStr = "fieldcontain";
        if(id.substring(0, subStr.length) === subStr){
            var s = id.indexOf('-') + 1;
            type = id.substr(s, id.lastIndexOf('-') - s);
        }
        else{
            type = id.substr(0, id.indexOf('-'));
        }

        return type;
    },

    /**
     * Determine the form type from editor property.
     * @param record Record json object.
     * @return form type.
     */
    typeFromRecord: function(record){
        var editor = record.properties.editor;
        return editor.substr(0, editor.indexOf('.json'));
    },

    /**
     * Helper function to read a value from localStorage modify it
     * and save it back
     * @param key - key of the value to use
     * @returns a function where the parsed value will be used with an optional
     *          return value that will be used for updating the stored value.
     */
    usingLocalStorage: function(key) {
        _this = this;

        return function(func) {
            var currentValue, newValue;

            currentValue = _this.readJSON(key);
            newValue = func(currentValue);
            if (newValue !== undefined) {
                _this.storeJSON(key, newValue);
            }
        };
    }
};

var _ios = {
    /**
     * TODO - use juery.guid ?
     */
    guid : (function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
        }
        return function() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };
    })(),

    /**
     *  @param fileURI is the location of the file in temp directory
     *  @param callback returns the file location after move
     */
    moveFileToPersistentStorage: function (fileURI ,callback){

        //move the file from tmp to assets dir
        var copiedFile = function (fileEntry) {

            callback(DOCUMENTS_SCHEME_PREFIX + fileEntry.fullPath);
        };

        var gotFileEntry = function(fileEntry) {

            var gotAsserDir = function(assetDir){

                var ext = "." + fileEntry.name.split('.').pop();


                fileEntry.moveTo( assetDir, _ios.guid() + ext,copiedFile, captureError);
            };

            //move to assets
            gotAsserDir(_base.getAssetsDir());

        };

        var tempFileName = fileURI.substr(fileURI.lastIndexOf('/')+1);

        var findFileInTemp = function(fileSystem){
            var reader = fileSystem.root.createReader();
            reader.readEntries(function(entries) {

                var i;
                for (i = 0; i < entries.length; i++) {

                    if(entries[i].name === tempFileName){

                        gotFileEntry(entries[i]);
                    }

                }
            });
        };


        window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, findFileInTemp, captureError);

    },

    /**
     * Construct the object for the options of the image for IOS.
     */
    getImageOptions: function(sourceType, encodingType){
        var options = _base.getImageOptions(sourceType, encodingType);
        options.saveToPhotoAlbum = true;
        return options;
    },

    /**
     * get photo from local filesystem ie the gallery on ios
     */
    getPhoto: function(callback) {
        var that = this;
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                function(fileURI){
                    that.moveFileToPersistentStorage(fileURI, callback);
                },
                captureError,
                this.getImageOptions(
                    navigator.camera.PictureSourceType.SAVEDPHOTOALBUM,
                    navigator.camera.MediaType.PICTURE)
            );
        }
    },

    /**
     * Invoke the device's audio recorder
     * ios version copys audio from tmp to permanent storage.
     * @param callback Function executed after successful recording.
     */
     takeAudio: function(callback){
        var that = this;

        if (navigator.device !== undefined){
            navigator.device.capture.captureAudio(
                function(mediaFiles){
                    var fileURI = mediaFiles[0].fullPath;

                    that.moveFileToPersistentStorage(fileURI, function(url){
                        callback({
                            url: url,
                            label: mediaFiles[0].name,
                            duration: mediaFiles[0].duration
                        });
                    });
                },
                captureError,
                {limit: 1}
            );
        }
    },

    /**
     * take photo action
     */
    takePhoto: function(callback){
        var that = this;
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                function(fileURI){
                    that.moveFileToPersistentStorage(fileURI, callback);
                },
                captureError,
                this.getImageOptions(
                    Camera.PictureSourceType.CAMERA,
                    Camera.EncodingType.JPEG)
            );
        }
    }
};

if(utils.isIOSApp()){

    $.extend(_this, _base, _ios);
}
else{
    _this = _base;
}

// Initialize the editor processing
_this.addProcessEditor(_this.extractEditorMetadata);

return _this;


});
