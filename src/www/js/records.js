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
/* global Camera */

define(['utils', 'file'], function(utils, file){
    var DOCUMENTS_SCHEME_PREFIX = "cdvfile://localhost/persistent";
    var assetsDir;
    var editorsDir;
    var assetTypes = ['image', 'audio'];

    if(utils.isMobileDevice()){
        // create directory structure for annotations
        file.createDir('assets', function(dir){
            assetsDir = dir;
        });
        file.createDir('editors', function(dir){
            editorsDir = dir;
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

var _base = {
    SAVED_RECORDS_KEY: 'saved-annotations',
    IMAGE_UPLOAD_SIZE: "imageUploadSize",
    IMAGE_SIZE_NORMAL: "imageSizeNormal",
    IMAGE_SIZE_FULL: "imageSizeFull",
    TITLE_ID: 'form-text-1',

    /**
     * Hide records on map event name.
     */
    EVT_DELETE_ANNOTATION: 'evt-delete-annotation',

    /**
     * Initialise annotate page.
     * @param form Form name.
     * @param callback Function to be invoked when editor has been loaded.
     */
    initPage: function(form, callback) {
        var url;
        var that = this;

        if(form === 'image' || form === 'audio' || form === 'text'){
            url = 'editors/' + form + '.edtr';
        }
        else{
            url =  file.getFilePath(editorsDir) + '/' + form + '.edtr';
        }

        $.ajax({
            url: url,
            dataType: "text",
            success: function(data){
                var form = $('#annotate-form').append(data);
                $.each($('input[capture=camera]'), function(index, input){
                    var btn = '<div id="annotate-image-' + index + '" class="image-chooser ui-grid-a">\
<div class="ui-block-a">\
<a class="annotate-image-take" href="#">\
<img src="css/images/images.png" alt="Take Photo"></a><p>Camera</p>\
</div>\
<div class="ui-block-b">\
<a class="annotate-image-get" href="#">\
<img src="css/images/gallery.png" alt="Choose Photo"></a><p>Gallery</p>\
</div></div>';

                    $(input).parent().append(btn + that.getImageSizeControl());
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

                utils.appendDateTimeToInput("#form-text-1");

                form.trigger('create');

                // hide original input elements
                $('input[capture]').parent().hide();

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
     * Add a new asset type. This allows plugins to define new types of assets.
     * @param type Asset type.
     */
    addAssetType: function(type){
        assetTypes.push(type);
    },

    /**
     * Annotate a record.
     * @param type The type of record to annotate.
     */
    annotate: function(type){
        localStorage.setItem('annotate-form-type', type);
        $('body').pagecontainer('change', 'annotate.html', {transition: "fade"});
    },

    /**
     * Annotate an image record.
     */
    annotateImage: function(){
        this.annotate('image');
    },

    /**
     * Annotate an audio record.
     */
    annotateAudio: function(){
        this.annotate('audio');
    },

    /**
     * Annotate a text record.
     */
    annotateText: function(){
        this.annotate('text');
    },

    /**
     * Delete all locally stored records.
     */
    clearSavedRecords: function(){
        localStorage.setItem(this.SAVED_RECORDS_KEY, '');
    },

    /**
     * Delete all editor forms.
     * @param callback Function executed when delete is complete.
     */
    deleteAllEditors: function(callback){
        // easiest way to do this is to delete the directory and recreate it
        file.deleteAllFilesFromDir(editorsDir, 'editors', function(dir){
            editorsDir = dir;
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
    deleteEditor: function(fileName, callback){
        this.deleteFile(fileName, editorsDir, callback);
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
     * @return Assets directory object.
     */
    getAssetsDir: function(){
        return assetsDir;
    },

    /**
     * Get list of local custom editors.
     * @param callback Funtion will be invoked when editors have been retrieved
     * contaioning a list of cordova file objects.
     */
    getEditors: function(callback){
        var editors = [];

        function success(entries) {
            $.each(entries, function(i, entry){
                editors.push(entry);
            });

            callback(editors);
        }

        function fail(error) {
            console.error("Failed to list editor directory contents: " + error.code);
            callback(editors);
        }

        // Get a directory reader
        if(editorsDir !== undefined){
            var directoryReader = editorsDir.createReader();
            directoryReader.readEntries(success, fail);
        }
    },

    /**
     * @return Editor forms directory object.
     */
    getEditorsDir: function(){
        return editorsDir;
    },

    /**
     * @param annotation Annotation record.
     * @return The editor id for a given annotation.
     */
    getEditorId: function(annotation){
        var record = annotation.record;
        return record.editor.substr(0, record.editor.indexOf('.'));
    },

    /**
     * @return Camera resize HTML.
     */
    getImageSizeControl: function(){
        var fullSelected = '', normalSelected = '', CHECKED = 'checked';

        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) === this.IMAGE_SIZE_FULL){
            fullSelected = CHECKED;
        }
        else{
            normalSelected = CHECKED;
        }


        var html = '<div class="ui-grid-solo"> \
                  <div class="ui-block-a"> \
                    <fieldset data-role="controlgroup" data-type="horizontal"> \
                      <input type="radio" name="radio-image-size" id="radio-view-a" value="imageSizeNormal" ' + normalSelected + ' /> \
                      <label for="radio-view-a">Normal</label> \
                      <input type="radio" name="radio-image-size" id="radio-view-b" value="imageSizeFull" ' + fullSelected + ' /> \
                      <label for="radio-view-b">Full</label>\
                    </fieldset><p>Image Size</p>\
                  </div>\
                </div>';
        return html;
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
    processAnnotation: function(recordType){
        var valid = true;
        var annotation = {
            "record": {
                'editor': recordType + '.edtr',
                'fields': []
            },
            "type": recordType,
            "isSynced": false
        };

        $.each($('div[class=fieldcontain]'), $.proxy(function(i, entry){
            var divId = $(entry).attr('id');
            var start = divId.indexOf('-') + 1;
            var end = divId.lastIndexOf('-');
            var type = divId.substr(start, end - start);
            var control;

            var record = {
                'id': divId
            };

            var setInputValue = function(control){
                var val = control.val();
                if(val){
                    record.val = val.trim();
                }
            };

            var doInput = function(controlType){
                control = $(entry).find(controlType);
                setInputValue(control);
            };

            var doLabel = function(id){
                record.label = $(entry).find('label[for="' + id + '"]').text();
            };

            var doLegend = function(){
                record.label = $(entry).find('legend').text();
            };

            var doTextField = function(controlType){
                doInput(controlType);
                doLabel(control.attr('id'));
            };

            if(type === 'text'){
                doTextField('input');
                if(control.attr('id') === this.TITLE_ID){
                    if(control.val()){
                        annotation.record.name = control.val();
                    }
                    record.val = '';
                }
            }
            else if(type === 'textarea'){
                doTextField(type);
            }
            else if(type === 'checkbox'){
                doLegend();
                $.each($(entry).find('input:checked'), function(j, checkbox){
                    if(typeof(record.val) === 'undefined'){
                        record.val = $(checkbox).val();
                    }
                    else{
                        record.val += ',' + $(checkbox).val();
                    }
                });
            }
            else if(type === 'radio'){
                var radioControl = $(entry).find('input:checked');
                record.label = $(entry).find('div[role=heading]').text();
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
                record.val = $(entry).find('.annotate-image img').attr('src');
                doLabel($(entry).find('input').attr('id'));


            }
            else if(type === 'audio'){
                control = $(entry).find('input[capture=microphone]');
                record.val = $(entry).find('.annotate-audio-taken input').attr('value');
                doLabel($(control).attr('id'));
            }
            else{
                console.warn("No such control type: " + type + ". div id = " + divId);
            }

            // do some validation
            if($(control).attr('required') === 'true' || $(control).attr('required') === 'required'){
                if(typeof(record.val) === 'undefined' || record.val.length === 0) {
                    if($(control).attr('id') === this.TITLE_ID){
                        if(typeof(annotation.record.name) === 'undefined'){
                            $(entry).find('#' + this.TITLE_ID).addClass('ui-focus');
                            valid = false;
                            return false;
                        }
                    }
                    else{
                        $(control).addClass('ui-focus');
                        valid = false;
                        return false;
                    }
                }
            }

            if(typeof(record.val) !== 'undefined' && record.val.length > 0){
                annotation.record.fields.push(record);
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

        return annotation;
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
            annotation.record.timestamp = date;
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
        annotation.record.point = {
            'lon': coords.lon,
            'lat': coords.lat
        };

        if(typeof(coords.gpsPosition) !== 'undefined'){
            annotation.record.point.alt = coords.gpsPosition.altitude;
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
        var invokeRecorder = function(){
            if (navigator.device !== undefined){
                navigator.device.capture.captureAudio(
                    function(mediaFiles){
                        callback({
                            url: mediaFiles[0].localURL,
                            label: mediaFiles[0].name,
                            duration: mediaFiles[0].duration
                        });
                    },
                    captureError,
                    {limit: 1}
                );
            }
        };

        // if it's possible check if the intent has an activity associated
        if(cordova && cordova.plugins && cordova.plugins.ActivitiesList){ // jshint ignore:line
            cordova.plugins                                               // jshint ignore:line
                .ActivitiesList.byIntent('android.provider.MediaStore.RECORD_SOUND',
                    function(activities){
                        if(activities.length > 0){
                            invokeRecorder();
                        }else{
                            $('#audiorecorder-error-popup').popup('open');
                        }
                    },function(error){
                        console.error(error);
                    });

        }else{
            invokeRecorder();
        }
    },

    /**
     * take photo action
     */
    takePhoto: function(callback){
        if (navigator.camera !== undefined){
            navigator.camera.getPicture(
                function(fileURI){
                    callback(fileURI);
                },
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

var _this = {};
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

                    that.moveFileToPersistentStorage(fileURI, function(){
                        callback({
                            url: mediaFiles[0].localURL,
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

return _this;


});
