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
    var GPS_AUTO_SAVE_THRESHOLD = 5;
    var PCAPI_VERSION = '1.3';

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
            url = this.editorsDir.fullPath + '/' + form + '.edtr';
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
            }
        });
    },

    /**
     * Delete annotation / record
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

            // save to local storage
            this.setSavedRecords(annotations);
        }
        else{
            console.warn("Attempted to delete record that didn't exist: " + id);
        }
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
     * TODO
     */
    getAssetsDir: function(){
        return assetsDir;
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
                this.onFail,
                this.getImageOptions(navigator.camera.PictureSourceType.SAVEDPHOTOALBUM, navigator.camera.MediaType.PICTURE)
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
     * Save annotations/record locally
     * @param annotation Record object.
     */
    saveRecord: function(id, annotation){
        var savedRecords = this.getSavedRecords();

        if(id === undefined){
            var date = new Date();
            annotation.record['timestamp'] = date;
            id = date.getTime().toString();
        }

        savedRecords[id] = annotation;
        this.setSavedRecords(savedRecords);

        return id;
    },

    /**
     * Save annotations/record locally
     * @param annotation Record object.
     */
    saveAnnotation: function(id, annotation){
        var savedAnnotations = this.getSavedRecords();

        if(id === undefined){
            var date = new Date();
            annotation.record['timestamp'] = date;
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
        }

        if(typeof(coords.gpsPosition) !== 'undefined'){
            annotation.record.point.alt = coords.gpsPosition.altitude;
        }

        this.saveRecord(undefined, annotation);
        //map.refreshAnnotations(annotation);
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
                this.onFail,
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
                this.onFail,
                this.getImageOptions(Camera.PictureSourceType.CAMERA, Camera.EncodingType.JPEG)
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
}


var _this = {};
var _ios = {

    getImageOptions: function(sourceType, encodingType){
        var options = {
            quality: 100,
            destinationType: Camera.DestinationType.FILE_URI,
            sourceType : sourceType,
            encodingType: encodingType,
            saveToPhotoAlbum: true
        }
        if(localStorage.getItem(this.IMAGE_UPLOAD_SIZE) != this.IMAGE_SIZE_FULL){
            options.targetWidth = 640;
            options.targetHeight = 480;
        }
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
