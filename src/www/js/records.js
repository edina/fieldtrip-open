/*
Copyright (c) 2014, EDINA,
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

/* jshint multistr: true */
/* global Camera, cordova */

define(['utils', 'file', 'underscore', 'text!templates/saved-records-list-template.html', 'text!templates/camera-capture-template.html'], function(// jshint ignore:line
    utils, file, _, recrowtemplate, cameraTemplate){

    var DOCUMENTS_SCHEME_PREFIX = "cdvfile://localhost/persistent";
    var EDITOR_CLASS = 'editor-class';
    var EDITOR_GROUP = {
        DEFAULT: 'default', // Embedded editor in the app
        PUBLIC:  'public',   // Public editors
        PRIVATE: 'private'  // Editors of an authenticated user
    };
    var IMAGE_TYPE_NAME = 'image';
    var AUDIO_TYPE_NAME = 'audio';

    var assetsDir;

    var editorDirectories = {};
    editorDirectories[EDITOR_GROUP.DEFAULT] = 'editors/';

    var assetDirectories = {};
    var assetTypes = [];

    // Array of functions that'll process the editor
    var processEditorPipeline = [];

    var EDITORS_METADATA = 'editors-metadata';

    if(utils.isMobileDevice()){
        // create directory structure for annotation assets
        file.createDir({
            'name': 'assets',
            'success': function(dir){
                assetsDir = dir;

                _this.addAssetType(IMAGE_TYPE_NAME);
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

    /************************** public interface  ******************************/
var _this = {};

var _base = {
    SAVED_RECORDS_KEY: 'saved-annotations',
    IMAGE_UPLOAD_SIZE: "imageUploadSize",
    IMAGE_SIZE_NORMAL: "imageSizeNormal",
    IMAGE_SIZE_FULL: "imageSizeFull",
    TITLE_ID: 'form-text-1',
    EDITOR_GROUP: EDITOR_GROUP,

    /**
     * Hide records on map event name.
     */
    EVT_DELETE_ANNOTATION: 'evt-delete-annotation',

    /**
     * Edit record format.
     */
    EVT_EDIT_ANNOTATION: 'evt-edit-annotation',

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
        }else{
            url = file.getFilePath(editorDirectories[group]) + '/' + type;
        }

        $.ajax({
            url: url,
            dataType: "text",
            success: function(data){
                var form = $('#annotate-form').append(data);
                $.each($('input[capture=camera]'), function(index, input){
                    $(input).parent().append(that.renderCameraExtras(index));
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

                // Create a popup and hide the original warning
                $.each($('div[id^=fieldcontain-warning-]'), function(index, item){
                    var $item = $(item);
                    var popup = '<div data-role="popup" class="warning-popup">\
                                   <h1>'+$item.find('label').text()+'</h1>\
                                   <div>\
                                     <img class="warning-icon" src="css/images/warning-icon@2x.png"/>\
                                     <span>'+$item.find('textarea').attr('placeholder')+'</span>\
                                   </div>\
                                   <br />\
                                   <a href="#" data-rel="back" data-role="button">Accept</a>\
                                </div>';

                    $('#annotate-form').append(popup);
                }).hide();

                utils.appendDateTimeToInput("#form-text-1");

                form.trigger('create');

                // hide original input elements
                $('input[capture]').parent().hide();

                // TODO: chain multiple popups
                $('.warning-popup').popup('open');

                callback();
            },
            error: function(jqXHR, status, error){
                var msg = "Problem with " + url + " : status=" +
                    status + " : " + error;
                console.error(msg);
                navigator.notification.alert(msg);
            },
        });
    },

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
     * Serialize the editors metadata into local storage as string
     * @param obj the object representing the editor metadata
     */
    saveEditorsMetadata: function(obj){
        var str = JSON.stringify(obj);
        localStorage.setItem(EDITORS_METADATA, str);
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
    addAssetType: function(type){
        assetTypes.push(type);

        if(assetsDir){
            file.createDir({
                'parent': assetsDir,
                'name': type,
                'success': function(assetDir){
                    assetDirectories[type] = assetDir;
                }
            });
        }
    },

    /**
     * Add a function to the editor process pipelina
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
     * Delete all locally stored records.
     */
    clearSavedRecords: function(){
        localStorage.setItem(this.SAVED_RECORDS_KEY, '');
    },

    /**
     * create record
     * @param group group that owns the editor
     * @param type of the editor
     * @returns record
     */
    createRecord: function(group, type){
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
     * @param callback Function executed when delete is complete.
     */
    deleteAllEditors: function(callback){
        this.initEditorsMetadata();
        // easiest way to do this is to delete the directory and recreate it
        file.deleteAllFilesFromDir(editorDirectories[EDITOR_GROUP.PRIVATE], function(dir){
            editorDirectories[EDITOR_GROUP.PRIVATE] = dir;
            callback();
        });
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
            _this.removeEditorsMetadata(group, editorName);
            callback();
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
     * Get internal annotation id for a given record name. This only applies to
     * synced records.
     * @param name Record name.
     */
    getAnnotationId: function(name) {
        var id;
        $.each(this.getSavedRecords(), function(i, annotation){
            // note: dropbox is case insensitive so we should be also
            if(annotation.record.name.toLowerCase() === name.toLowerCase() &&
               annotation.isSynced){
                id = i;
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
            encodingType: encodingType
        };
        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) != this.IMAGE_SIZE_FULL){
            options.targetWidth = 640;
            options.targetHeight = 480;
        }
        return options;
    },

    /**
     * get photo from local filesystem
     */
    getPhoto: function(callback) {
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                function(fileURI){
                    callback(fileURI);
                },
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

    /**
     * Does this record field define an asset?
     * @param field Annotation record field.
     * @param type Optional record type. If undefined it will be determined by the id.
     */
    isAsset: function(field, type){
        var isAsset = false;

        if(type === undefined){
            type = this.typeFromId(field.id);
        }

        if($.inArray(type, assetTypes) != -1){
            isAsset = true;
        }

        return isAsset;
    },

    /**
     * Process annotation/record from an HTML5 form.
     * @param recordType record/Form type - image, text, audio or custom
     */
    processAnnotation: function(group, recordType){
        var valid = true;
        var annotation = this.createRecord(group, recordType);

        $.each($('div[class=fieldcontain]'), $.proxy(function(i, entry){
            var divId = $(entry).attr('id');
            var start = divId.indexOf('-') + 1;
            var end = divId.lastIndexOf('-');
            var type = divId.substr(start, end - start);
            var control;

            var ignoreField = false;
            var field = {
                id: divId,
                val: null
            };

            var setInputValue = function(control){
                var val = control.val();
                field.val = val.trim();
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
                field.label = $(entry).find('div[role=heading]').text();
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
                field.val = $(entry).find('.annotate-image img').attr('src');
                doLabel($(entry).find('input').attr('id'));
            }
            else if(type === 'audio'){
                control = $(entry).find('input[capture=microphone]');
                field.val = $(entry).find('.annotate-audio-taken input').attr('value');
                doLabel($(control).attr('id'));
            }
            else if(type === 'warning'){
                // Ignore this type of field
                ignoreField = true;
            }
            else{
                console.warn("No such control type: " + type + ". div id = " + divId);
            }

            // do some validation
            if($(control).attr('required') === 'true' || $(control).attr('required') === 'required'){
                // Validate the record name
                if($(control).attr('id') === this.TITLE_ID){
                    if(control.val()){
                        // Use this control value as a record name
                        annotation.record.name = control.val();
                        // But don't include it as a record field
                        ignoreField = true;
                    }else{
                        $(control).addClass('ui-focus');
                        valid = false;
                        return false;
                    }
                }
                // Validate the fields
                else if(field.val === null ||
                        field.val === undefined ||
                        field.val === "") {
                    $(control).addClass('ui-focus');
                    valid = false;
                    return false;
                }
            }

            if(ignoreField === false){
                annotation.record.properties.fields.push(field);
            }
        }, this));

        if(valid){
            // nasty I know: but changing page in a setTimeout allows
            // time for the keyboard to close
            setTimeout(function(){
                $('body').pagecontainer('change', 'annotate-preview.html');
            }, 300);
        }
        else{
            utils.inform('Required field not populated');
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
     * function for processing the editor
     * @param editorName name of the editor
     * @param html, html content
     * @param group public/private
     */
    processEditor: function(editorName, html, group){
        for(var i =0; i<processEditorPipeline.length; i++){
           var process = processEditorPipeline[i];
           if(typeof(process) === 'function'){
               process.apply(null, arguments);
           }
        }
    },


    /**
     * function for processing the editor
     * @param editorName name of the editor
     * @param html html content of the editor
     * @param group public/private
     */
    processEditorMetadata: function(editorName, html, group){
        var $form = $(html);
        var editorsObj = _this.loadEditorsMetadata();
        editorsObj[group][editorName] = {};

        // Add the dom class that will be used in the buttons
        var editorClass = $('#dtree-class-name', $form).text();
        if(editorClass !== ""){
            editorsObj[group][editorName]['class'] = editorClass;
        }else{
            editorsObj[group][editorName]['class'] = 'annotate-custom-form';
        }

        // Add the group to the editor
        editorsObj[group][editorName].group = group;

        // Add the type of the editor
        editorsObj[group][editorName].type = editorName;

        // Add the title wich will be displayed
        var title = $form.data('title');
        if(title !== undefined){
            editorsObj[group][editorName].title = title;
        }else{
            var matches = editorName.match(/(.*).edtr$/);
            if(matches && matches.length > 1){
                editorsObj[group][editorName].title = matches[1];
            }else{
                editorsObj[group][editorName].title = editorName;
            }
        }

        _this.saveEditorsMetadata(editorsObj);
    },


    removeEditorsMetadata: function(group, editorName){
        var editorsObj = _this.loadEditorsMetadata();
        delete editorsObj[group][editorName];
        _this.saveEditorsMetadata(editorsObj);
    },

    /**
     * function for rendering the extra options for camera on the form
     * @param index which is the id
     * @returns html rendered
     */
    renderCameraExtras: function(index){
        var fullSelected = '', normalSelected = '', CHECKED = 'checked';

        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) === this.IMAGE_SIZE_FULL){
            fullSelected = CHECKED;
        }
        else{
            normalSelected = CHECKED;
        }
        var template =  _.template(cameraTemplate);
        return template({"index": index, "fullSelected": fullSelected, "normalSelected": normalSelected});
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
    saveAnnotationWithCoords: function(annotation, coords){
        annotation.record.geometry.coordinates = [
            coords.lon,
            coords.lat
        ];

        if(typeof(coords.gpsPosition) !== 'undefined'){
            annotation.record.geometry.coordinates[2] = coords.gpsPosition.altitude;

            if(typeof(annotation.record.properties.pos_acc) !== 'undefined'){ // jshint ignore:line
                annotation.record.properties.pos_acc = coords.gpsPosition.accuracy; // jshint ignore:line
            }
        }

        this.saveAnnotation(undefined, annotation);
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
                        var media = mediaFiles[0];
                        file.moveTo({
                            'path': media.fullPath,
                            'to': that.getAssetsDir(AUDIO_TYPE_NAME),
                            'success': function(newEntry){
                                callback({
                                    url: newEntry.toURL(),
                                    label: media.name,
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
                        'success': function(newEntry){
                            callback(newEntry.toURL());
                        }
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
     * @param id Field div id.
     * @return The control type for a field id.
     */
    typeFromId: function(id){
        var s = id.indexOf('-') + 1;
        return id.substr(s, id.lastIndexOf('-') - s);
    }
};

var _ios = {

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

                fileEntry.moveTo( assetDir, fileEntry.name ,copiedFile, captureError);
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
_this.addProcessEditor(_this.processEditorMetadata);

return _this;


});
