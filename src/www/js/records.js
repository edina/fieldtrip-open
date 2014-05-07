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

define(['utils'], function(utils){
    var assetsDir;
    var editorsDir;

    if(utils.isMobileDevice()){
        // create directory structure for annotations
        utils.getPersistentRoot(function(root){
            root.getDirectory(
                "assets",
                {create: true, exclusive: false},
                function(dir){
                    assetsDir = dir;
                },
                function(error){
                    utils.inform('Failed finding assets directory. Saving will be disabled: ' + error);
                });
            root.getDirectory(
                "editors",
                {create: true, exclusive: false},
                function(dir){
                    editorsDir = dir;
                },
                function(error){
                    utils.inform('Failed finding editors directory. Custom forms will be disabled: ' + error);
                });
        });
    }

    /**
     * Capture error alert.
     * @param error Cordova error. If user cancels this will be undefined.
     */
    var captureError = function(error){
        if(error !== undefined && error.code !== undefined){
            var msg = "Problem with capture: " + error.code + " : ";
            switch(error.code){
            case CaptureError.CAPTURE_INTERNAL_ERR:
                msg += " Interval Error."
                break;
            case CaptureError.CAPTURE_APPLICATION_BUSY:
                msg += " Application busy."
                break;
            case CaptureError.CAPTURE_INVALID_ARGUMENT:
                msg += " Invalid Argument."
                break;
            case CaptureError.CAPTURE_NO_MEDIA_FILES:
                msg += " No media files."
                break;
            case CaptureError.CAPTURE_NOT_SUPPORTED:
                msg += " Not supported."
                break;
            default:
                msg += " Unknown Error."
            }
            console.debug(msg);
            alert(msg);
        }
        else{
            console.debug("Capture error is undefined. Assume user cancelled.");
        }
    };

var _base = {
    IMAGE_UPLOAD_SIZE: "imageUploadSize",
    IMAGE_SIZE_NORMAL: "imageSizeNormal",
    IMAGE_SIZE_FULL: "imageSizeFull",
    TITLE_ID: 'form-text-1',

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
            url = editorsDir.toNativeURL() + '/' + form + '.edtr';
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
<img src="css/images/images.png"></a><p>Camera</p>\
</div>\
<div class="ui-block-b">\
<a class="annotate-image-get" href="#">\
<img src="css/images/gallery.png"></a><p>Gallery</p>\
</div></div>'

                    $(input).parent().append(btn + that.getImageSizeControl());
                });
                $.each($('input[capture=microphone]'), function(index, input){
                    var btn = '<div id="annotate-audio-' + index + '">\
<a class="annotate-audio" href="#">\
<img src="css/images/audio.png"></a><p>Start</p>\
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
                    status + " : " + error
                console.error(msg);
                alert(msg);
            },
        });
    },

    /**
     * Annotate a record.
     * @param type The type of record to annotate.
     */
    annotate: function(type){
        localStorage.setItem('annotate-form-type', type);
        $.mobile.changePage('annotate.html', {transition: "fade"});
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
     * Delete all editor forms.
     * @param callback Function executed when delete is complete.
     */
    deleteAllEditors: function(callback){
        // easiest way to do this is to delete the directory and recreate it
        editorsDir.removeRecursively(
            function(){
                utils.getPersistentRoot(function(root){
                    root.getDirectory(
                        "editors",
                        {create: true, exclusive: false},
                        function(dir){
                            editorsDir = dir;
                            callback();
                        },
                        function(error){
                            utils.inform('Failed finding editors directory. Custom forms will be disabled: ' + error);
                            callback();
                        }
                    );
                });
            },
            function(error){
                console.error("Problem deleting directory");
                callback();
            }
        );
    },

    /**
     * delete annotation / record
     * @param annotation id of record to be deleted.
     */
    deleteAnnotation: function(id){
        var annotations = this.getSavedRecords();
        var annotation = annotations[id];

        if(annotation !== undefined){
            // TODO: what about assets?
            if(typeof(annotation.type) !== 'undefined' && annotation.type === 'track'){
                if(typeof(annotation.file) !== 'undefined'){
                    utils.deleteFile(
                        annotation.file.substr(annotation.file.lastIndexOf('/') + 1),
                        assetsDir,
                        function(){
                            console.debug("GPX file deleted: " + annotation.file);
                        });
                }
            }

            // remove annotation from hash
            delete annotations[id];

            //remove geofence if one exists
            if(typeof(geofencing) !== 'undefined'){
                geofencing.removeRegion(id);
            }

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
        utils.deleteFile(fileName, dir, callback);
    },

    /**
     * Get internal annotation id and record for a given record name. This only
     * applies to synced records.
     * @param name Record name.
     */
    getAnnotationDetails: function(name) {
        var details = undefined;
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
        var id = undefined;
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
                //utils.printObj(entry);
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
     * TODO
     */
    getImageSizeControl:function (){
        var fullSelected = '', normalSelected = '', CHECKED = 'checked';

        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) === this.IMAGE_SIZE_FULL){
            fullSelected = CHECKED;
        }
        else{
            normalSelected = CHECKED;
        }
        return '<div class="ui-grid-solo">\
<div class="ui-block-a"> \
<fieldset data-role="controlgroup" data-type="horizontal"> \
<input type="radio" name="radio-image-size" id="radio-view-a" value="imageSizeNormal" ' + normalSelected +' /> \
<label for="radio-view-a">Normal</label> \
<input type="radio" name="radio-image-size" id="radio-view-b" value="imageSizeFull" ' + fullSelected + ' /> \
<label for="radio-view-b">Full</label>\
</fieldset><p>Image Size</p>\
</div>\
</div>';
    },

    /**
     * construct the object for the options of the image
     */
    getImageOptions: function(sourceType, encodingType){
        var options = {
            quality: 100,
            destinationType: Camera.DestinationType.FILE_URI,
            sourceType : sourceType,
            encodingType: encodingType
        }
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
     * TODO
     */
    getSavedRecord: function(id){
        return this.getSavedRecords()[id];
    },

    /**
     * @return List of saved records in local storage.
     */
    getSavedRecords: function(){
        var KEY = 'saved-annotations';
        var savedAnnotations = {};
        var savedAnnotationsObj = localStorage.getItem(KEY);

        if(savedAnnotationsObj &&
           savedAnnotationsObj.length > 0 &&
           savedAnnotationsObj != '[null]'){

            try{
                savedAnnotations = JSON.parse(savedAnnotationsObj);
            }
            catch(error){
                // somethings went wrong with save, delete contents
                console.error(error);
                localStorage.removeItem(KEY);
            }
        }

        return savedAnnotations;
    },


    /**
     * @return list of all records excluding tracks
     */
    getSavedRecordsExcludingTracks: function() {
        var filteredRecords = {};
        $.each(this.getSavedRecords(), function(objId, annotation){
            if (annotation.record.editor !== 'track.edtr') {
                filteredRecords[objId] = annotation;            
            }    
        });
        return filteredRecords;    
    },
    
    /**
     * @return Check if supplied annotation is a track or not
     */
    isTrack: function(annotation) {
        return annotation.trackId === undefined;
    },
    
    /**
     * @return list of tracks
     */
    getSavedTracks: function() {
        var filteredRecords = {};
        $.each(this.getSavedRecords(), function(objId, annotation){
            if (annotation.record.editor === 'track.edtr') {
                filteredRecords[objId] = annotation;            
            }    
        });
        return filteredRecords;    
    },



    /**
     * @return id of an annotation in savedRecords list
     */
    getAnnotationIdFromSavedRecords: function(desiredAnnotation) {
        var id = undefined;
        $.each(this.getSavedRecords(), function(i, annotation){
            // Compare on timestamp
            if(annotation.record.timestamp === desiredAnnotation.record.timestamp){
                id = i;
                return false; 
            }
        });
        return id;
    },

    /**
     * @return List of saved records corresponding to track annotation object or just the track id.
     */
    getSavedRecordsForTrack: function(annotation){
        var id = annotation;
        // annotation could be an acutal annotation object - get the id from it if this is the case
        if (typeof(annotation) === 'object') {
            id = this.getAnnotationIdFromSavedRecords(id);
        }
        var filteredRecords = {};
        $.each(this.getSavedRecords(), function(objId, annotation){
            var trackId = annotation['trackId'];
            if(trackId !== undefined){ 
                // convert id to String in case it was passed in as a number
                if (trackId === id.toString()) {
                    filteredRecords[objId] = annotation;
                }
            } 
        });
        return filteredRecords;
    },



    /**
     * Process annotation/record from an HTML5 form.
     * @param type Form type - image, text, audio or custom
     */
    processAnnotation: function(type){
        var valid = true;
        var annotation = {
            "record": {
                'editor': type + '.edtr',
                'fields': []
            },
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
                    record['val'] = val.trim();
                }
            }

            var doInput = function(controlType){
                control = $(entry).find(controlType);
                setInputValue(control);
            };

            var doLabel = function(id){
                record['label'] = $(entry).find('label[for="' + id + '"]').text();
            };

            var doLegend = function(){
                record['label'] = $(entry).find('legend').text();
            };

            var doTextField = function(controlType){
                doInput(controlType);
                doLabel(control.attr('id'));
            };

            if(type === 'text'){
                doTextField('input');
                if(control.attr('id') === this.TITLE_ID){
                    if(control.val()){
                        annotation.record['name'] = control.val();
                    }
                    record['val'] = '';
                }
            }
            else if(type === 'textarea'){
                doTextField(type);
            }
            else if(type === 'checkbox'){
                doLegend();
                $.each($(entry).find('input:checked'), function(j, checkbox){
                    if(typeof(record['val']) === 'undefined'){
                        record['val'] = $(checkbox).val();
                    }
                    else{
                        record['val'] += ',' + $(checkbox).val();
                    }
                });
            }
            else if(type === 'radio'){
                var control = $(entry).find('input:checked');
                record['label'] = $(entry).find('div[role=heading]').text();
                setInputValue(control);
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
                record['val'] = $(entry).find('.annotate-image img').attr('src');
                doLabel($(entry).find('input').attr('id'));


            }
            else if(type === 'audio'){
                control = $(entry).find('input[capture=microphone]');
                record['val'] = $(entry).find('.annotate-audio-taken input').attr('value');
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
                annotation.record['fields'].push(record);
            }
        }, this));

        if(valid){
            // nasty I know: but changing page in a setTimeout allows
            // time for the keyboard to close
            setTimeout(function(){
                $.mobile.changePage('annotate-preview.html');
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
        var savedAnnotations = this.getSavedRecords();

        if(id === undefined){
            var date = new Date();
            annotation.record['timestamp'] = date;
            id = date.getTime().toString();
            annotation.record.geofenceId = id;
        }

        savedAnnotations[id] = annotation;
        this.setSavedRecords(savedAnnotations);

        // Fire newTextCreated event if a 
        // text annotation with no pre-existing trackId 
        if (annotation.record.editor === 'text.edtr') {

            if (annotation.trackId === undefined) {
                $.event.trigger({
                    type:    "newTextCreated",
                    id: id,
                    time:    new Date()
                });
            }
       }
        return id;
    },

    /**
     * Save annotation with the coords currently selected.
     */
    saveAnnotationWithCoords: function(annotation, coords){
        annotation.record.point = {
            'lon': coords.lon,
            'lat': coords.lat
        }

        if(typeof(coords.gpsPosition) !== 'undefined'){
            annotation.record.point.alt = coords.gpsPosition.altitude;
        }

        return this.saveAnnotation(undefined, annotation);
    },

    /**
     * Save annotations to local storage.
     * @annotations Hash of local records.
     */
    setSavedRecords: function(annotations){
        //console.debug(JSON.stringify(annotations, undefined, 2));
        localStorage.setItem('saved-annotations', JSON.stringify(annotations));
    },

    /**
     * Invoke the device's audio recorder
     * @param callback Function executed after successful recording.
     */
    takeAudio: function(callback){
        if (navigator.device !== undefined){
            navigator.device.capture.captureAudio(
                function(mediaFiles){
                    callback(mediaFiles[0].fullPath);
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
    },

    /**
     * Write string to file
     * @param fileName The new file name.
     * @param data The new file content.
     * @param dir Optional directory object. If undefined use assestDir.
     * @param callback The function that is executed when file has finished writing.
     */
    writeToFile: function(fileName, data, dir, callback){
        if(dir === undefined){
            dir = assetsDir;
        }

        utils.writeToFile(fileName, data, dir, callback);
    }
}


var _this = {};
var _ios = {

    /**
     * TODO
     */
    getImageOptions: function(sourceType, encodingType){
        var options = _base.getImageOptions();
        options.saveToPhotoAlbum = true;
        return options;
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
