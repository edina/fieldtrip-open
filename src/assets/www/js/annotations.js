"use strict";

/**
 * Provides functionality for capturing Annotations/Records
 * @param options
 *    map         - openlayers map wrapper
 *    isMobileApp - is this running inside a mobile app?
 *    storage     - local storage object
 */
function Annotations(options) {
    this.map = options.map;
    this.isMobileApp = options.isMobileApp;
    this.db = this.map.storage;

    if(this.isMobileApp){
        // create directory structure for annotations
        Utils.getPersistentRoot($.proxy(function(root){
            root.getDirectory(
                "assets",
                {create: true, exclusive: false},
                $.proxy(function(dir){
                    this.assetsDir = dir;
                }, this),
                function(error){
                    Utils.inform('Failed finding assets directory. Saving will be disabled: ' + error);
                });
            root.getDirectory(
                "editors",
                {create: true, exclusive: false},
                $.proxy(function(dir){
                    this.editorsDir = dir;
                }, this),
                function(error){
                    Utils.inform('Failed finding editors directory. Custom forms will be disabled: ' + error);
                });
        }, this));
    }
};

// how many GPS updates do we receive before autosaving
Annotations.GPS_AUTO_SAVE_THRESHOLD = 5;
Annotations.TITLE_ID = 'form-text-1';
Annotations.PCAPI_VERSION = '1.3';
Annotations.IMAGE_UPLOAD_SIZE = "imageUploadSize";
Annotations.IMAGE_SIZE_NORMAL = "imageSizeNormal";
Annotations.IMAGE_SIZE_FULL = "imageSizeFull";

/**
 * Clear cloud login session.
 */
Annotations.prototype.clearCloudLogin = function(){
    this.userId = undefined;
    this.db.clearCloudLogin();
}

/**
 * Check if users session is valid.
 * @param Function executed with return status. Good status is == 1.
 */
Annotations.prototype.cloudCheckUser = function(callback){
    if(!this.userId){
        var userId = this.db.getCloudLogin().id;
        if(userId){
            var url = this.getCloudProviderUrl() + '/auth/dropbox/' + userId;
            console.debug("Check user with: " + url);
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: url,
                cache: false,
                success: $.proxy(function(data){
                    // Utils.printObj(data);
                    if(data.state === 1){
                        this.userId = userId;
                    }

                    callback(data.state);
                }, this),
                error: function(error){
                    //Utils.printObj(error);
                    console.error("Error with user: " + url + " : " + error.msg);
                    callback(-1);
                }
            });
        }
        else{
            console.debug("No user session saved");
            callback(-1);
        }
    }
    else{
        callback(1);
    }
};

/**
 * Login to cloud provider.
 * @param callback The function that is executed when user has logged in.
 * @param cbrowser Function called for access to child browser reference.
 */
Annotations.prototype.cloudLogin = function(callback, cbrowser){
    var loginUrl = this.getCloudProviderUrl() + '/auth/dropbox';

    var pollTimer, pollTimerCount = 0, pollInterval = 3000, pollForMax = 5 * 60 * 1000; //min

    var userId = this.db.getCloudLogin().id;
    if(userId){
        console.debug("got a user id: " + userId);
        loginUrl += '/' + userId;
    }

    // clear user id
    this.db.clearCloudLogin();
    console.debug('Login with: ' + loginUrl + '?async=true');

    $.ajax({
        url: loginUrl + '?async=true',
        timeout: 3000,
        cache: false,
        success: $.proxy(function(data){
            console.debug("Redirect to: " + data.url);
            var cloudUserId = data.userid;

            // close child browser
            var closeCb = function(){
                clearInterval(pollTimer);
                callback();
            }

            // open dropbox login in child browser
            var cb = window.open(data.url, '_blank', 'location=no');
            cb.addEventListener('exit', closeCb);

            var pollUrl = loginUrl + '/' + cloudUserId + '?async=true';
            console.debug('Poll: ' + pollUrl);
            pollTimer = setInterval($.proxy(function(){
                $.ajax({
                    url: pollUrl,
                    success: $.proxy(function(pollData){
                        pollTimerCount += pollInterval;

                        if(pollData.state === 1 || pollTimerCount > pollForMax){
                            if(pollData.state === 1 ){
                                this.db.saveCloudLogin(cloudUserId);
                            }
                            cb.close();
                        }

                    }, this),
                    error: function(error){
                        console.error("Problem polling api: " + error.statusText);
                        closeCb();
                    },
                    cache: false
                });
            }, this), pollInterval);

            if(cbrowser){
                // caller may want access to child browser reference
                cbrowser(cb);
            }
        }, this),
        error: function(jqXHR, textStatus){
            var msg;
            if(textStatus === undefined){
                textStatus = ' Unspecified Error.'
            }
            else if(textStatus === "timeout") {
                msg = "Unable to login, please enable data connection.";
            }
            else{
                msg = "Problem with login: " + textStatus;
            }

            Utils.printObj(jqXHR);
            console.error(msg);
            Utils.inform(msg);
        }
    });
};

/**
 * Create remote record.
 * @param record Record object to create remotely.
 * @param callback
 */
Annotations.prototype.createRemoteRecord = function(id, record, callback) {
    var userId = this.db.getCloudLogin().id;

    // clone record for remote copy
    var dropboxRecord = jQuery.extend(true, {}, record);

    // create record URL
    var recordDir = this.getCloudProviderUrl() + '/records/dropbox/' +
        userId + '/' + record.name;

    if(dropboxRecord.point !== undefined){
        // convert remote record coords to WGS84
        pointToWGS84(dropboxRecord.point);

        // convert asset URLs to simple filename
        $.each(dropboxRecord.fields, $.proxy(function(i, field){
            if(this.isAsset(field)){
                field.val = field.val.substr(field.val.lastIndexOf('/') + 1);
            }
        }, this));

        var assetCount = 0;
        var success = true;
        var finished = function(){
            --assetCount;
            if(assetCount < 1){
                var delay = 0;
                if(!success){
                    delay = 3000;
                    Utils.inform('An error has occurred syncing');
                }

                setTimeout(function(){
                    callback(success);
                }, delay);
            }
        }

        console.debug("Post: " + recordDir);

        // post record
        $.ajax({
            url: recordDir,
            type: "POST",
            cache: false,
            data: JSON.stringify(dropboxRecord, undefined, 2),
            success: $.proxy(function(data){
                // check if new record name
                var s = data.path.indexOf('/', 1) + 1;
                var name = data.path.substr(s, data.path.lastIndexOf('/') - s);
                if(record.name !== name){
                    // name has been changed by api
                    console.debug(record.name + " renamed to " + name);
                    Utils.inform(record.name + " renamed to " + name);
                    record.name = name;
                    $('#' + id + ' h3').text(name);

                    // update URL
                    recordDir = this.getCloudProviderUrl() + '/records/dropbox/' +
                        userId + '/' + record.name;
                }

                // create any asserts associated with record
                $.each(record.fields, $.proxy(function(i, field){
                    var type = typeFromId(field.id);
                    if(this.isAsset(field, type)){
                        ++assetCount;
                        var options = new FileUploadOptions();
                        //options.chunkedMode = false;  // ?

                        if(type === 'audio'){
                            options.mimeType = "audio/3gpp";
                        }
                        else if(type === 'track'){
                            options.mimeType = "text/xml";
                        }

                        var fileName = field.val.substr(field.val.lastIndexOf('/') + 1);
                        var assetUrl = recordDir + '/' + fileName;
                        options.fileName = fileName;

                        setTimeout(function(){
                            var ft = new FileTransfer();
                            ft.upload(
                                field.val,
                                encodeURI(assetUrl),
                                function(result){
                                    Utils.printObj(result);
                                    finished();
                                },
                                function(error){
                                    Utils.printObj(error);
                                    console.error("Problem uploading asset: " +
                                                  assetUrl + ", error = " + error.code);
                                    success = false;
                                    finished();
                                },
                                options
                            );
                        }, 1000);
                    }
                }, this));

                if(assetCount === 0){
                    finished();
                }
            }, this),
            error: function(jqXHR, status, error){
                console.error("Problem creating remote directory " + recordDir +
                              " : " + status + " : " + error);
                success = false;
                finished();
            }
        });
    }
    else{
        console.error("record has no location delete it: " + record.name);

        // executing callback synchronously causes problems for the calling function
        setTimeout(function(){
            callback(false);
        }, 500);
    }
};

/**
 * Delete annotation / record
 * @param annotation id of record to be deleted.
 * @param refreshMap Should map be notified of deletion?
 */
Annotations.prototype.deleteAnnotation = function(id, refreshMap){
    var annotations = this.getSavedAnnotations();
    var annotation = annotations[id];

    if(annotation !== undefined){
        // TODO: what about assets?
        if(typeof(annotation.type) !== 'undefined' && annotation.type === 'track'){
            if(typeof(annotation.file) !== 'undefined'){

                // TODO use deleteFile method
                this.assetsDir.getFile(
                    annotation.file.substr(annotation.file.lastIndexOf('/') + 1),
                    {create: false},
                    function(fileEntry){
                        fileEntry.remove(
                            function(entry){
                                console.debug("GPX file deleted: " + annotation.file);
                            },
                            function(error){
                                console.error("Failed to delete gpx file:" + annotation.file + ". errcode = " + error.code);
                            });
                    },
                    function(error){
                        console.error("Failed to find gpx file: " + annotation.file + ". errcode = " + error.code);
                    });
            }
        }

        // remove annotation from hash
        delete annotations[id];

        // save to local storage
        this.setSavedAnnotations(annotations);

        if(refreshMap){
            // inform map of change
            this.map.refreshAnnotations();
        }
    }
    else{
        console.warn("Attempted to delete record that didn't exist: " + id);
    }
}

/**
 * Delete annotation / record by name
 * @param annotation Name of record to be deleted.
 * @param refreshMap Should map be notified of deletion?
 */
Annotations.prototype.deleteAnnotationByName = function(name, refreshMap){
    var id = this.getAnnotationId(name);
    if(id){
        this.deleteAnnotation(id, refreshMap);
    }
    else{
        console.warn("No annotation found with name: " + name);
    }

    return id;
};

/**
 * Delete a single editor from file system.
 * @param fileName The name of the file to delete.
 * @param callback Function will be called when editor is successfully deleted.
 */
Annotations.prototype.deleteEditor = function(fileName, callback){
    this.deleteFile(fileName, this.editorsDir, callback);
};

/**
 * Delete a file from file system.
 * @param fileName The name of the file to delete.
 * @param dir The directory the file belongs to.
 * @param callback Function will be called when editor is successfully deleted.
 */
Annotations.prototype.deleteFile = function(fileName, dir, callback){
    if(dir === undefined){
        dir = this.assetsDir;
    }

    dir.getFile(
        fileName,
        {create: true, exclusive: false},
        function(fileEntry){
            fileEntry.remove(
                function(entry){
                    console.debug("File deleted: " + fileName);
                    if(callback){
                        callback();
                    }
                },
                function(error){
                    console.error("Failed to delete file:" + fileName +
                                  ". errcode = " + error.code);
                });
        },
        function(error){
            console.error("Failed to create file: " + fileName +
                          ". errcode = " + error.code);
        }
    );
};

/**
 * Remove all editors from filesystem.
 * @param callback Function will be called when editors have been successfully
 * deleted.
 */
Annotations.prototype.deleteAllEditors = function(callback){
    // easiest way to do this is to delete the directory and recreate it
    this.editorsDir.removeRecursively(
        $.proxy(function(){
            Utils.getPersistentRoot($.proxy(function(root){
                root.getDirectory(
                    "editors",
                    {create: true, exclusive: false},
                    $.proxy(function(dir){
                        this.editorsDir = dir;
                        callback();
                    }, this),
                    function(error){
                        Utils.inform('Failed finding editors directory. Custom forms will be disabled: ' + error);
                        callback();
                    });
            }, this));
        }, this),
        function(error){
            console.error("Problem deleting directory");
            callback();
        }
    );
};

/**
 * Download editor from dropbox.
 * @param editor The editor name.
 * @param callback Function will be called when editor is successfully downloaded.
 */
Annotations.prototype.downloadRemoteEditor = function(editor, callback){
    var userId = this.db.getCloudLogin().id;
    var root = this.getCloudProviderUrl() + '/fs/dropbox/' + userId;
    var editorUrl = root + "/editors/" + editor;

    $.ajax({
        type: "GET",
        url: editorUrl,
        success: $.proxy(function(data){
            if(typeof(data.error) === 'undefined'){
                var s = editor.lastIndexOf('/') + 1;
                this.writeToFile(
                    //editor.substr(s, editor.lastIndexOf('.')),
                    editor,
                    data,
                    this.editorsDir,
                    callback
                );
            }
            else{
                console.error("Error returned with " + editorUrl +
                              " : error = " + data.error);
                callback(false);
            }
        }, this),
        error: function(jqXHR, status, error){
            Utils.inform('Editor Problem: ' + editor, 3000, error);
            console.error("Error downloading editor: " + editorUrl +
                          " : status=" + status + " : " + error);
            callback(false);
        },
        cache: false
    });
};

/**
 * Download remote record from dropbox.
 * @param name Record name/title.
 * @param callback Function will be called when the new record is successfully
 * updated.
 * @param orgRecord Object containing id and original record, if record is to be
 * downloaded.
 */
Annotations.prototype.downloadRemoteRecord = function(name, callback, orgRecord){
    var userId = this.db.getCloudLogin().id;
    var rootUrl = this.getCloudProviderUrl() + '/records/dropbox/' + userId + "/" + name;
    var recordUrl = rootUrl + "/record.json";

    var assetCount = 0;
    var finished = $.proxy(function(record, success){
        --assetCount;

        if(assetCount < 1){
            var id = undefined;
            var annotation = undefined;
            var delay = 0;

            if(success){
                if(orgRecord === undefined){
                    // create brand new record
                    annotation = {
                        "record": record,
                        "isSynced": true
                    };
                }
                else{
                    // update existing record
                    annotation = orgRecord.annotation;
                    annotation.record = record;
                    id = orgRecord.id;
                }

                if(name !== annotation.record.name){
                    // update record name if they don't match, this is for cases
                    // where the record name (directory name) is different from
                    // the name inside the record
                    annotation.record.name = name;
                }

                id = this.saveAnnotation(id, annotation);
            }
            else{
                // allow time to display any error
                delay = 3000;
            }

            if(callback){
                setTimeout(function(){
                    callback(success, id, annotation);
                }, delay);
            }
        }
    }, this);

    console.debug("Fetch " + recordUrl);
    $.ajax({
        type: "GET",
        dataType: "json",
        url: recordUrl,
        cache: false,
        success: $.proxy(function(record){
            //Utils.printObj(record);

            // convert coordinates to national grid
            pointToNationalGrid(record.point);

            //  fetch assets and convert URLs
            $.each(record.fields, $.proxy(function(i, field){
                if(this.isAsset(field)){
                    ++assetCount;

                    var source = rootUrl + "/" + field.val;
                    //var target = this.assetsDir.fullPath + "/" + name + "/" + field.val;
                    var target = this.assetsDir.fullPath + "/" + Utils.santiseForFilename(name + field.val);

                    console.debug("download: " + source + " to " + target);

                    new FileTransfer().download(
                        encodeURI(source),
                        target,
                        function(entry) {
                            console.debug("download complete: " + entry.fullPath);

                            // asset local path becomes new record field val
                            field.val = entry.fullPath;

                            finished(record, true);
                        },
                        function(error) {
                            // if this fails first check whitelist in cordova.xml
                            Utils.informError("Problem syncing " + name);
                            console.error("Problem downloading asset: " + error.source +
                                          " to: " + error.target + " error: " + error.code);
                            finished(record, false);
                        }
                    );

                }
            }, this));

            if(assetCount === 0){
                finished(record, true);
            }
        }, this),
        error: function(error){
            var msg = "Failed to fetch record " + name;
            console.error(msg);
            Utils.informError(msg);
            finished(undefined, false);
        }
    });
};

/**
 * Export (to file system) saved annotations as GPX,
 * returns the full path of the saved file
 */
Annotations.prototype.exportAnnotations = function() {
    // create XML doc first using jquery's parseXML function,
    // then use standard dom methods for building the XML
    var doc = $.parseXML('<?xml version="1.0" encoding="UTF-8"?><gpx></gpx>');
    var gpx = doc.getElementsByTagName('gpx')[0];
    gpx.setAttribute('xmlns', 'http://www.topografix.com/GPX/1/1');

    // create metadata header
    var meta = doc.createElement('metadata');
    var now = new Date();
    var nowUTC = new Date(now.getUTCFullYear(),
                          now.getUTCMonth(),
                          now.getUTCDate(),
                          now.getUTCHours(),
                          now.getUTCMinutes(),
                          now.getUTCSeconds());
    meta.setAttribute('time', nowUTC);
    doc.documentElement.appendChild(meta);

    // now add annotations
    var annotations = this.getSavedAnnotations();
    for(var i = 0; i < annotations.length; i++){
        var params = annotations[i].options.params;
        var wpt = doc.createElement('wpt');

        wpt.setAttribute('lat', params.latitude);
        wpt.setAttribute('lon', params.longitude);

        var nameElement = doc.createElement('name');
        nameElement.appendChild(doc.createTextNode(params.title));
        wpt.appendChild(nameElement);

        if(params.details){
            var descElement = doc.createElement('desc');
            descElement.appendChild(doc.createTextNode(params.details));
            wpt.appendChild(descElement);
        }
        if(annotations[i].fileURI){
            var linkElement = doc.createElement('link');
            linkElement.setAttribute('href', annotations[i].fileURI);
            wpt.appendChild(linkElement);
        }

        doc.documentElement.appendChild(wpt);
    }

    // file name is the current date
    var fileName = (now.toString().substr(0, 24) + '.gpx').replace(/\s|:/g, '_');
    var sXML = new XMLSerializer().serializeToString(doc);

    // TODO use generic writeToFile
    var assetsDirPath = this.assetsDir.fullPath;
    this.assetsDir.getFile(
        fileName,
        {create: true, exclusive: false},
        function(fileEntry){
            fileEntry.createWriter(
                function(writer){
                    writer.onwrite = function(evt) {
                        navigator.notification.alert('GPX file ' + fileName + ' written to ' + assetsDirPath);
                    };
                    writer.write(sXML);
                },
                function(error){
                    console.error("Failed to write to gpx file:" + fileName + ". errcode = " + error.code);
                });
        },
        function(error){
            console.error("Failed to create gpx file: " + fileName + ". errcode = " + error.code);
        }
    );

    return assetsDirPath + '/' + fileName;
};

/**
 * Get internal annotation id and record for a given record name. This only
 * applies to synced records.
 * @param name Record name.
 */
Annotations.prototype.getAnnotationDetails = function(name) {
    var details = undefined;
    $.each(this.getSavedAnnotations(), function(i, annotation){
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
};

/**
 * Get internal annotation id for a given record name. This only applies to
 * sycned records.
 * @param name Record name.
 */
Annotations.prototype.getAnnotationId = function(name) {
    var id = undefined;
    $.each(this.getSavedAnnotations(), function(i, annotation){
        // note: dropbox is case insensitive so we should be also
        if(annotation.record.name.toLowerCase() === name.toLowerCase() &&
           annotation.isSynced){
            id = i;
            return false; // breaks loop!
        }
    });

    return id;
};

/**
 * Get a audio file from album
 */
Annotations.prototype.getAudio = function() {
    Utils.inform('Not implemented');
};

/**
 * Get list of local custom editors.
 * @param callback Funtion will be invoked when editors have been retrieved.
 */
Annotations.prototype.getEditors = function(callback) {
    var editors = [];

    function success(entries) {
        $.each(entries, function(i, entry){
            //Utils.printObj(entry);
            editors.push(entry);
        });

        callback(editors);
    }

    function fail(error) {
        console.error("Failed to list editor directory contents: " + error.code);
        callback(editors);
    }

    // Get a directory reader
    if(this.editorsDir !== undefined){
        var directoryReader = this.editorsDir.createReader();
        directoryReader.readEntries(success, fail);
    }
};

/**
 * Get record id for as given record name.
 * @param name Record name.
 * @return Record id or undefined if not found.
 */
Annotations.prototype.getRecordId = function(name){
    var id = undefined;
    $.each(this.getSavedAnnotations(), function(i, annotation){
        if(annotation.record.name === name){
            id = i;
            return false;
        }
    });

    return id;
}

/**
 * Get a photo from album.
 * @param callback Funtion will be invoked when image has been retrieved.
 */
Annotations.prototype.getPhoto = function(callback) {
    if (navigator.camera !== undefined){
        navigator.camera.getPicture(
            function(fileURI){
                callback(fileURI);
            },
            this.onFail,
            deviceDependent.addImageSizeProperties({
                destinationType: navigator.camera.DestinationType.FILE_URI,
                sourceType: navigator.camera.PictureSourceType.SAVEDPHOTOALBUM,
                mediaType: navigator.camera.MediaType.PICTURE
            })
        );
    }
};

/**
 * @return locally stored annotations
 */
Annotations.prototype.getSavedAnnotations = function() {
    return this.db.getSavedAnnotations();
};

/**
 * @return Number of locally stored annotations.
 */
Annotations.prototype.getSavedAnnotationsCount = function() {
    var i = 0;
    $.each(this.db.getSavedAnnotations(), function(){
        i++;
    });

    return i;
};

/**
 * Get a video from album.
 */
Annotations.prototype.getVideo = function(){
    // if (navigator.camera !== undefined){
    //     navigator.camera.getPicture(
    //         function(fileURI){
    //             var media = {
    //                 'name': fileURI,
    //                 'fullPath': fileURI,
    //                 'size': undefined
    //             };

    //             onMediaSuccess(media, 'videoContents', 'css/images/video.png');
    //         },
    //         onFail,
    //         {
    //             destinationType: navigator.camera.DestinationType.FILE_URI,
    //             sourceType: navigator.camera.PictureSourceType.SAVEDPHOTOALBUM,
    //             mediaType: navigator.camera.MediaType.VIDEO
    //         });
    // }
    alert('Not implemented yet');
}

/**
 * Start GPX track.
 * @param annotation Annotation metadata object
 * @param debug Use dummy GPS tracking.
 */
Annotations.prototype.gpsTrack = function(annotation, debug){
    if(!this.currentTrack){
        var now = Utils.isoDate();
        var fileName  = (now + '.gpx').replace(/\s|:/g, '_');
        var fullName;

        if(this.assetsDir){
            fullName = this.assetsDir.fullPath + '/' + fileName;
        }

        // initialise record point with user's current location
        var start = this.map.getUserCoords();
        annotation.record.point = {
            'lon': start.lon,
            'lat': start.lat,
            'alt': start.gpsPosition.altitude
        }

        annotation.record.fields[1].val = fullName;
        var id = this.saveAnnotation(undefined, annotation);

        // create XML doc first using jquery's parseXML function,
        // then use standard dom methods for building the XML
        var doc = $.parseXML('<?xml version="1.0" encoding="UTF-8"?><gpx></gpx>');
        var gpx = doc.getElementsByTagName('gpx')[0];
        gpx.setAttribute('xmlns', 'http://www.topografix.com/GPX/1/1');
        gpx.setAttribute('version', '1.1');
        gpx.setAttribute('creator', 'fieldtripGB');

        // create metadata header
        var meta = doc.createElement('metadata');
        var time = doc.createElement('time');
        time.appendChild(doc.createTextNode(now));
        meta.appendChild(time);
        doc.documentElement.appendChild(meta);

        var trk = doc.createElement('trk');
        var trkseg = doc.createElement('trkseg');
        trk.appendChild(trkseg);

        doc.documentElement.appendChild(trk);

        this.currentTrack = {
            'id': id,
            'file': fileName,
            'doc': doc
        }

        // kick off tracking
        this.gpsTrackPlay(annotation.rate, debug);
    }
};

/**
 * Resume GPS track after pause.
 */
Annotations.prototype.gpsTrackPause = function(){
    this.map.gpsTrackPause();
};

/**
 * Start/Resume GPS track.
 * @param captureRate How often, in seconds, a track point should be recorded.
 * @param debug Use debug mode?
 */
Annotations.prototype.gpsTrackPlay = function(captureRate, debug){
    var cr = captureRate * 1000; // in milliseconds

    // continue tracking
    this.map.gpsTrack(cr,
                      $.proxy(function(position){
                          this.gpsCaptureAutoSave(position);
                      }, this),
                      debug);
};

/**
 * Save current GPS position to GPX doc. Periodically auto save the doc to file.
 * @param position Contains position coordinates and timestamp, created by the
 * geolocation API.
 */
Annotations.prototype.gpsCaptureAutoSave = function(position){
    if(typeof this.gpsReceiveCount === 'undefined'){
        this.gpsReceiveCount = 0;
    }

    var trkseg= this.currentTrack.doc.getElementsByTagName('trkseg')[0];
    var trkpt = this.currentTrack.doc.createElement('trkpt');

    trkpt.setAttribute('lat', parseFloat(position.coords.latitude).toFixed(6));
    trkpt.setAttribute('lon', parseFloat(position.coords.longitude).toFixed(6));

    var ele = this.currentTrack.doc.createElement('ele');
    ele.appendChild(this.currentTrack.doc.createTextNode(position.coords.altitude));
    trkpt.appendChild(ele);

    var time = this.currentTrack.doc.createElement('time');

    time.appendChild(this.currentTrack.doc.createTextNode(
        Utils.isoDate(new Date(position.timestamp))));
    trkpt.appendChild(time);
    trkseg.appendChild(trkpt);

    ++this.gpsReceiveCount;

    if(this.gpsReceiveCount === Annotations.GPS_AUTO_SAVE_THRESHOLD){
        this.gpsCaptureSave();
        this.gpsReceiveCount = 0;
    }
};

/**
 * Complete current GPS capture.
 */
Annotations.prototype.gpsCaptureComplete = function(){
    if(typeof(this.currentTrack) !== 'undefined'){
        var annotation = this.getSavedAnnotations()[this.currentTrack.id];

        this.gpsTrackPause();

        // populate record with start location
        var startPoint = this.map.getGpsTrackStart();

        if(startPoint !== undefined){
            annotation.record.point = startPoint;
            // save the annotation to local storage
            this.saveAnnotation(this.currentTrack.id, annotation);

            var id = this.currentTrack.id;

            // save the GPX file
            this.gpsCaptureSave($.proxy(function(){
                // removing all annotation will force a refresh
                this.map.getAnnotationsLayer().removeAllFeatures();

                // display saved track on map
                this.map.showGPSTrack(id, annotation);
            }, this));
        }
        else{
            console.debug('Track ' + this.currentTrack.title +
                          ' has no points');
            this.deleteAnnotation(this.currentTrack.id);
        }

        this.map.gpsTrackStop();
        this.currentTrack = undefined;
    }
}

/**
 * Discard current GPS capture.
 */
Annotations.prototype.gpsCaptureDiscard = function(){
    this.map.gpsTrackStop();

    //cleanup temp track
    if(this.currentTrack){
        // delete GPX file and record
        this.deleteFile(this.currentTrack.file);
        this.deleteAnnotation(this.currentTrack.id);
    }

    this.currentTrack = undefined;
}

/**
 * Save current track as a GPX file.
 * @param callback Function executed after a sucessful save.
 */
Annotations.prototype.gpsCaptureSave = function(callback){
    var sXML = new XMLSerializer().serializeToString(this.currentTrack.doc);

    if(this.assetsDir){
        var assetsDirPath = this.assetsDir.fullPath;
        var fileName = this.currentTrack.file;
        this.assetsDir.getFile(
            fileName,
            {create: true, exclusive: false},
            function(fileEntry){
                fileEntry.createWriter(
                    function(writer){
                        writer.onwrite = function(evt) {
                            console.debug('GPX file ' + fileName + ' written to ' + assetsDirPath);
                        };
                        writer.write(sXML);

                        if(callback){
                            callback();
                        }
                    },
                    function(error){
                        console.error("Failed to write to gpx file:" + fileName + ". errcode = " + error.code);
                    });
            },
            function(error){
                console.error("Failed to create gpx file: " + fileName + ". errcode = " + error.code);
            }
        );
    }
};

/**
 * Is a GPS track in progress?
 */
Annotations.prototype.gpsTrackStarted = function(){
    return this.currentTrack !== undefined;
};

/**
 * Is there a GPS track currently paused?
 */
Annotations.prototype.gpsTrackPaused = function(){
    return this.gpsTrackStarted() && !this.map.gpsTrackRunning();
};

/**
 * Initialise annotate page.
 * @param form Form name.
 * @param callback Function to be invoked when editor has been loaded.
 */
Annotations.prototype.initPage = function(form, callback) {
    var url;
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
                             </div>'

                var imageSizeControl = deviceDependent.getImageSizeControl();

                $(input).parent().append(btn + imageSizeControl);
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

            Utils.appendDateTimeToInput("#form-text-1");


            form.trigger('create');



            // hide original input elements
            $('input[capture]').parent().hide();

            callback();
        }
    });
};

/**
 * Does this field define an asset?
 * @param field Annotation record field.
 * @param type Optional record type. If undefined it will be determied by the id.
 */
Annotations.prototype.isAsset = function(field, type) {
    var isAsset = false;

    if(type == undefined){
        type = typeFromId(field.id);
    }

    if(type === 'image' || type === 'audio' || type === 'track'){
        isAsset = true;
    }

    return isAsset;
}

/**
 * Failed to fetch image.
 */
Annotations.prototype.onFail = function(message) {
    //alert('Failed because: ' + message);
};

/**
 * Process annotation/record from an HTML5 form.
 * @param type Form type - image, text, audio or custom
 */
Annotations.prototype.processAnnotation = function(type){
    var valid = true;
    var annotation = {
        "record": {
            'editor': type + '.edtr',
            'fields': []
        },
        "isSynced": false
    };

    $.each($('div[class=fieldcontain]'), function(i, entry){
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
            if(control.attr('id') === Annotations.TITLE_ID){
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
                if($(control).attr('id') === Annotations.TITLE_ID){
                    if(typeof(annotation.record.name) === 'undefined'){
                        $(entry).find('#' + Annotations.TITLE_ID).addClass('ui-focus');
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
    });

    if(valid){
        // nasty I know: but changing page in a setTimeout allows
        // time for the keyboard to close
        setTimeout(function(){
            $.mobile.changePage('annotate-preview.html');
        }, 300);
    }
    else{
        Utils.inform('Required field not populated');
    }

    return annotation;
};

/**
 * Save annotations/record locally
 * @param annotation Record object.
 */
Annotations.prototype.saveAnnotation = function(id, annotation){
    var savedAnnotations = this.getSavedAnnotations();

    if(id === undefined){
        var date = new Date();
        annotation.record['timestamp'] = date;
        id = date.getTime().toString();
    }

    savedAnnotations[id] = annotation;
    this.setSavedAnnotations(savedAnnotations);

    return id;
};

/**
 * Save annotation with the coords currently selected.
 */
Annotations.prototype.saveAnnotationWithCoords = function(annotation){
    var coords = this.map.getAnnotationCoords(false);
    annotation.record.point = {
        'lon': coords.lon,
        'lat': coords.lat
    }

    if(typeof(coords.gpsPosition) !== 'undefined'){
        annotation.record.point.alt = coords.gpsPosition.altitude;
    }

    this.saveAnnotation(undefined, annotation);
    this.map.refreshAnnotations(annotation);
}

/**
 * Save current state of the form,
 */
Annotations.prototype.saveCurrentState = function(){
    this.title = $('#annotate-title').val();
    this.details = $('#annotate-details').val();
};

/**
 * @return The current URL of the cloud provider (pcapi).
 */
Annotations.prototype.getCloudProviderUrl = function() {
    return Utils.getServerUrl() + "/" + Annotations.PCAPI_VERSION + "/pcapi";
};

/**
 * Save annotations to local storage.
 * @annotations Hash of local records.
 */
Annotations.prototype.setSavedAnnotations = function(annotations){
    //console.debug(JSON.stringify(annotations, undefined, 2));
    this.db.set('saved-annotations', JSON.stringify(annotations));
};

/**
 * Sync annotations and editors with cloud provider.
 * options:
 * @param callback A function that will be executed for each annotation created
 * or deleted as part of the sync.
 * @param complete - A function that will be executed when sync is complete.
 */
Annotations.prototype.sync = function(options) {
    $.mobile.showPageLoadingMsg();

    var annotations = this.getSavedAnnotations();
    var user = this.db.getCloudLogin();

    // upload unsynced records
    var doUpload = $.proxy(function(){
        this.syncUploadRecords($.proxy(function(){
            this.syncStoreCursor();
            this.map.refreshAnnotations();
            $.mobile.hidePageLoadingMsg();

            if(options.complete){
                options.complete();
            }
        }, this));
    }, this);

    // sync uploaded records with dropbox
    if(user.cursor === undefined){
        // no cursor found do a full sync
        this.syncDownloadAllEditors($.proxy(function(success){
            if(success){
                this.syncDownloadAllRecords(doUpload, options.callback);
            }
            else{
                $.mobile.hidePageLoadingMsg();
                Utils.inform("Problem syncing editors.");
            }
        }, this));
    }
    else{
        // sync using cursor
        this.syncWithCursor(
            function(success){
                if(success){
                    doUpload();
                }
                else{
                    $.mobile.hidePageLoadingMsg();
                    Utils.inform("Problem syncing with cursor.");
                }
            },
            options.callback
        );
    }
};

/**
 * Sync editors with cloud provider.
 * @param callback Function executed after sync is complete.
 */
Annotations.prototype.syncDownloadAllEditors = function(callback) {
    Utils.inform("Sync editors ...");

    var userId = this.db.getCloudLogin().id;

    var finished = function(success){
        if(callback){
            callback(success);
        }
    };

    this.deleteAllEditors($.proxy(function(){
        var url = this.getCloudProviderUrl() + '/editors/dropbox/' + userId+'/';

        console.debug("Sync editors with " + url);

        $.ajax({
            type: "GET",
            dataType: "json",
            url: url,
            success: $.proxy(function(data){
                if(data.error === 1 || data.metadata.length === 0){
                    // nothing to do
                    Utils.inform('No editors to sync');
                    finished(true);
                }
                else{
                    var count = 0;
                    var noOfEditors = data.metadata.length;

                    //Utils.printObj(data.metadata);

                    // do sync
                    $.each(data.metadata, $.proxy(function(i, editor){
                        // TODO work would correct filename and path
                        var s = editor.lastIndexOf('/') + 1;
                        var fileName = editor.substr(s, editor.lastIndexOf('.'));
                        this.downloadRemoteEditor(fileName, function(){
                            ++count;
                            if(count === noOfEditors){
                                finished(true);
                            }
                        });

                        //Utils.printObj(data);
                    }, this));
                }
            }, this),
            error: function(jqXHR, status, error){
                console.error("Problem with " + url + " : status=" +
                              status + " : " + error);
                finished(false);
            },
            cache: false
        });
    }, this));
};

/**
 * Sync records with cloud provider.
 * @param complete Function executed when sync is complete.
 * @param callback Function executed each time an annotation is added or deleted.
 */
Annotations.prototype.syncDownloadAllRecords = function(complete, callback) {
    console.debug("Sync download all records");
    Utils.inform("Sync records ...");

    var annotations = this.getSavedAnnotations();
    var user = this.db.getCloudLogin();

    // all locally synced records will first be deleted
    $.each(annotations, $.proxy(function(id, annotation){
        if(annotation.isSynced){
            console.debug("Delete synced record: " + id);
            this.deleteAnnotation(id);

            if(callback){
                callback(false, id);
            }
        }
    }, this));

    var recordsDir = this.getCloudProviderUrl() + '/records/dropbox/' + user.id + "/";
    var downloadQueue = [];
    var count = 0;

    console.debug("Fetch current records: " + recordsDir);

    // function for downloading next record in queue
    var downloadRemoteRecord = $.proxy(function(){
        var recordName = downloadQueue.pop();
        if(recordName){
            Utils.inform("Download " + recordName);

            this.downloadRemoteRecord(
                recordName,
                function(success, id, annotation){
                    --count;
                    // add new record
                    if(callback && success){
                        callback(true, id, annotation);
                    }

                    // get next in queue
                    downloadRemoteRecord();
                }
            );
        }

        if(count === 0){
            complete();
        }
    }, this);

    // fetch records
    $.ajax({
        type: "GET",
        dataType: "json",
        url: recordsDir,
        success: $.proxy(function(data){
            if(data.error === 0){
                $.mobile.showPageLoadingMsg();
                $.each(data.records, $.proxy(function(i, record){
                    // the first property of each object is the name
                    for(var name in record){
                        downloadQueue.push(name);
                        break;
                    };

                }, this));

                if(downloadQueue.length === 0){
                    complete();
                }
                else{
                    count = downloadQueue.length;
                    console.debug(downloadQueue.length + " to download");
                    // create thread threads for downloading
                    var downloadThreads = 3;
                    for(var i = 0; i < downloadThreads; i++){
                        downloadRemoteRecord();
                    }
                }
            }
            else{
                // TODO the user should be informed of a failure
                // (when https://redmine.edina.ac.uk/issues/5812 is resolved)
                console.error("Error with fetching records:" + data.msg);
                $.mobile.hidePageLoadingMsg();
                Utils.inform("Sync Error " + data.msg, 5000);

                complete();
            }
        }, this),
        error: function(jqXHR, status, error){
            console.error("Problem fetching " + recordsDir + " : " +
                          status + " : " + error);
            complete();
        },
        cache: false
    });
};

/**
 * Sync records and editors.
 * @param complete Function executed when sync is complete.
 * @param callback Function executed each time an annotation is added or deleted.
 */
Annotations.prototype.syncWithCursor = function(complete, callback) {
    var user = this.db.getCloudLogin();

    // track asynchronous jobs
    var jobs = 0;
    var finished = function(){
        --jobs;
        if(jobs === 0){
            complete(true);
        }
    };

    // retrieve file type and value
    var getDetails = function(path){
        var val;
        var start = path.indexOf('/', 1) + 1;
        var end = path.indexOf('/', start);
        if(end === -1){
            // no end slash its a directory
            val = path.substr(start);
        }
        else{
            val = path.substr(start, end - start);
        }

        return {
            'type': path.substr(1, 7),
            'val': val
        }
    };

    // sync records
    var url = this.getCloudProviderUrl() + '/sync/dropbox/' + user.id + "/" + user.cursor;
    console.debug("Sync download with cursor: " + url);
    $.ajax({
        type: "GET",
        dataType: "json",
        url: url,
        success: $.proxy(function(data){
            Utils.printObj(data);
            var records = [];

            // deleted records and editors
            $.each(data.deleted, $.proxy(function(i, path){
                var details = getDetails(path);
                if(details.type === 'records'){
                    if($.inArray(details.val, records) === -1){
                        var id = this.deleteAnnotationByName(details.val, false);
                        if(callback){
                            callback(false, id);
                        }
                        records.push(details.val);
                    }
                }
                else if(details.type === 'editors'){
                    this.deleteEditor(details.val);
                }
                else{
                    console.warn("No such record type: " + details.type);
                }
            }, this));

            records = [];

            // updated records and editors
            $.each(data.updated, $.proxy(function(i, path){
                var details = getDetails(path);
                if(details.type === 'records'){
                    // a record update could be the directory, the record json
                    // and assets, this check ensures that the record is only
                    // fetched once
                    if($.inArray(details.val, records) === -1){
                        // just download the record and assets
                        var record = this.getAnnotationDetails(details.val);
                        ++jobs;
                        records.push(details.val);
                        this.downloadRemoteRecord(
                            details.val,
                            function(success, id, annotation){
                                if(success && record === undefined && callback){
                                    // record undefined means a new record has been
                                    // downloaded, perhaps as a rename
                                    callback(true, id, annotation);
                                }

                                finished();
                            },
                            record);
                    }
                }
                else if(details.type === 'editors'){
                    ++jobs;
                    this.downloadRemoteEditor(details.val, function(){
                        finished();
                    });
                }
                else{
                    console.warn("No such record type:" + details.type);
                }
            }, this));

            if(jobs === 0){
                complete(true);
            }
        }, this),
        error: function(jqXHR, status, error){
            console.error("SyncWithCursor: Problem fetching " + url + " : " +
                          status + " : " + error);
            complete(false);
        },
        cache: false
    });
};

/**
 * Store current dropbox state cursor with cloud login details.
 */
Annotations.prototype.syncStoreCursor = function(){
    var user = this.db.getCloudLogin();
    var url = this.getCloudProviderUrl() + '/sync/dropbox/' + user.id;
    $.ajax({
        type: "GET",
        dataType: "json",
        url: url,
        success: $.proxy(function(data){
            console.debug("Save cursor: " + data.cursor);
            this.db.saveCloudLogin(user.id, data.cursor);
        }, this),
        error: function(jqXHR, status, error){
            console.error("syncStoreCursor: Problem fetching cursor " + url + " : " +
                          status + " : " + error);
        },
        cache: false
    });
};

/**
 * Upload unsynced records.
 * @param complete Function executed when upload is complete.
 */
Annotations.prototype.syncUploadRecords = function(complete) {
    // do upload sync
    var annotations = this.getSavedAnnotations();
    var uploadCount = 0;
    $.each(annotations, $.proxy(function(id, annotation){
        if(!annotation.isSynced){
            $('#' + id + ' .ui-block-a').removeClass(
                'saved-annotations-list-synced-false');
            $('#' + id + ' .ui-block-a').addClass(
                'saved-annotations-list-syncing');

            ++uploadCount;
            this.createRemoteRecord(id, annotation.record, $.proxy(function(success){
                --uploadCount;
                $('#' + id + ' .ui-block-a').removeClass(
                    'saved-annotations-list-syncing');
                if(success){
                    $('#' + id + ' .ui-block-a').addClass(
                        'saved-annotations-list-synced-true');

                    annotation.isSynced = true;
                    this.saveAnnotation(id, annotation);
                }
                else{
                    $('#' + id + ' .ui-block-a').addClass(
                        'saved-annotations-list-synced-false');
                }

                if(uploadCount === 0){
                    complete();
                }
            }, this));
        }
    }, this));

    if(uploadCount === 0){
        complete();
        Utils.inform('Nothing to upload');
    }
};

/**
 * Invoke the phone's audio recorder
 * @param callback Function executed after successful recording.
 */
Annotations.prototype.takeAudio = function(callback){
    if (navigator.device !== undefined){
        navigator.device.capture.captureAudio(
            function(mediaFiles){
                callback(mediaFiles[0].fullPath);
            },
            this.onFail,
            {limit: 1}
        );
    }
};

/**
 * Invoke the phone's camera.
 * @param callback Funtion will be invoked when photo has been taken.
 */
Annotations.prototype.takePhoto = function(callback){
    if (navigator.camera !== undefined){
        navigator.camera.getPicture(
            function(fileURI){
                callback(fileURI);
            },
            this.onFail,
            deviceDependent.addImageSizeProperties({
                quality: 100,
                destinationType: Camera.DestinationType.FILE_URI,
                sourceType : Camera.PictureSourceType.CAMERA,
                encodingType: Camera.EncodingType.JPEG,
            })
        );
    }
};

/**
 * Invoke the phone's camcorder.
 */
Annotations.prototype.takeVideo = function(){
    alert('Not yet implemented');
};

/**
 * Toggle annotations layer.
 */
Annotations.prototype.toggleAnnotations = function(){
    this.map.toggleAnnotationsLayer();
};

/**
 * Write string to file
 * @param fileName The new file name.
 * @param data The new file content.
 * @param dir Optional directory object. If undefined use assestDir.
 * @param callback The function that is executed when file has finished writing.
 */
Annotations.prototype.writeToFile = function(fileName, data, dir, callback){
    if(dir === undefined){
        dir = this.assetsDir;
    }

    dir.getFile(
        fileName,
        {create: true, exclusive: false},
        function(fileEntry){
            fileEntry.createWriter(
                function(writer){
                    writer.onwrite = function(evt) {
                        console.debug('File ' + fileName +
                                      ' written to ' + dir.fullPath);
                        if(callback){
                            callback();
                        }
                    };
                    writer.write(data);
                },
                function(error){
                    console.error("Failed to write to file:" + fileName +
                                  ". errcode = " + error.code);
                });
        },
        function(error){
            console.error("Failed to create file: " + fileName +
                          ". errcode = " + error.code);
        }
    );
};

/**
 * Generate play audio node.
 * @param url Audio file URL.
 * @param label Optional text label.
 */
function audioNode(url, label){
    if(label === undefined){
        label = '';
    }

    return '<div class="annotate-audio-taken">' + label + '\
              <input type="hidden" value="' + url + '"/>\
              <p id="annotate-audio-position">0.0 sec</p>\
              <a id="annotate-audio-button" class="annotate-audio-stopped" onclick="playAudio();" data-theme="a" data-iconpos="notext" href="#" data-role="button" ></a>\
            </div>';
}

// current/last played audio
var currentAudio;

/**
 * Play audio track.
 */
function playAudio(){
    var url = $('.annotate-audio-taken input').attr('value');

    if(currentAudio){
        if(currentAudio.src !== url){
            currentAudio.destroy();
            currentAudio = new Audio(url);
        }
    }
    else{
        currentAudio = new Audio(url);
    }

    if(currentAudio.status === Media.MEDIA_RUNNING ||
       currentAudio.status === Media.MEDIA_STARTING){
        currentAudio.stop();
    }
    else{
        currentAudio.play();
    }
}

/**
 * Audio media class.
 * @param src The media file.
 */
function Audio(src){
    this.src = src;

    // Create Media object from src
    this.media = new Media(src,
                           $.proxy(this.onSuccess, this),
                           $.proxy(this.onError, this),
                           $.proxy(function(status) {
                               this.status = status;
                           }, this));

    this.status = Media.MEDIA_NONE;
}

/**
 * Play audio track.
 */
Audio.prototype.play = function() {
    this.media.play();

    $('#annotate-audio-button').removeClass('annotate-audio-stopped');
    $('#annotate-audio-button').addClass('annotate-audio-started');

    // Update my_media position every second
    if(this.mediaTimer == null) {
        this.mediaTimer = setInterval($.proxy(function(){
            this.media.getCurrentPosition(
                $.proxy(function(position) {
                    if (position > -1) {
                        $('#annotate-audio-position').text((position.toFixed(1)) + ' sec');
                    }
                }, this),
                // error callback
                function(e) {
                    console.error("Error getting pos=" + e);
                }
            );
        }, this), 1000);
    }
};

/**
 * Release audio resources.
 */
Audio.prototype.destroy = function() {
    if (this.media) {
        this.media.release();
    }
};

/**
 * Pause audio track.
 */
Audio.prototype.pause = function() {
    if (this.media) {
        this.media.pause();
    }
};

/**
 * Stop audio track.
 */
Audio.prototype.stop = function() {
    if (this.media) {
        this.media.stop();
    }

    this.clear();
};

/**
 * Clear audio track.
 */
Audio.prototype.clear = function(){
    clearInterval(this.mediaTimer);
    this.mediaTimer = null;

    $('#annotate-audio-position').text('0.0 sec');

    $('#annotate-audio-button').addClass('annotate-audio-stopped');
    $('#annotate-audio-button').removeClass('annotate-audio-started');
}

/**
 * Audio track has successfully played.
 */
Audio.prototype.onSuccess = function(position){
    this.clear();
};

/**
 * Error playing audio track.
 */
Audio.prototype.onError = function(error) {
    alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
};

/**
 * @param annotation Annotation record.
 * @return The editor id for a given annotation.
 */
function getEditorId(annotation){
    var record = annotation.record;
    return record.editor.substr(0, record.editor.indexOf('.'));
}

/**
 * @param id Field div id.
 * @return The control type for a field id.
 */
function typeFromId(id){
    var s = id.indexOf('-') + 1;
    return id.substr(s, id.lastIndexOf('-') - s);
}
