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

/**
 * interface for cordova File plugin
 */

/* global FileError, FileTransferError */

define(['utils'], function(utils){

    /**
     * Get application root directory.
     * @param callback Function executed after root has been retrieved.
     * @param type LocalFileSystem.PERSISTENT or LocalFileSystem.TEMPORARY
     */
    var getFileSystemRoot = function(callback, type){
        window.requestFileSystem(
            type,
            0,
            function(fileSystem){
                fileSystem.root.getDirectory(
                    _this.getRootDir(),
                    {create: true, exclusive: false},
                    function(dir){
                        callback(dir);
                    },
                    function(error){
                        navigator.notification.alert('Failed to get file system:' + error);
                    });
            },
            function(error){
                navigator.notification.alert('Failed to get file system:' + error);
            }
        );
    };

var _base =  {

    /**
     * Append a file string to a directory entry.
     * @param dir DirectoryEntry.
     * @param file File name.
     * @return The full path of the directory.
     */
    appendFile: function(dir, file){
        var path = this.getFilePath(dir);
        if(!path.endsWith("/")){
            path += "/";
        }

        return path + file;
    },

    /**
     * Create Directory.
     * @param options:
     *   parent DirectoryEntry object. If not defined directory will be created
     *          relative to edina root.
     *   name directory name that needs to be created
     *   success Function will be called when dir is successfully created.
     *   error Function will be called when an error occurs.
     */
    createDir: function(options){
        if(options.error === undefined){
            options.error = function(error){
                utils.inform('Problem creating directory: ' + error);
            };
        }

        var create = function(entry){
            entry.getDirectory(
                options.name,
                {create: true, exclusive: false},
                options.success,
                options.error
            );
        };

        if(options.parent){
            create(options.parent);
        }
        else{
            this.getPersistentRoot(function(root){
                create(root);
            });
        }
    },

    /**
     * Delete a directory from file system.
     * @param dir The directory the file belongs to.
     * @param callback Function will be called when file is successfully deleted.
     */
    deleteDirectory: function(dirName, callback){
        if(dirName === undefined){
            console.warn("Target directory not defined: " + dirName);
        }
        else{
            this.resolveFileURL(dirName).done(function(dirEntry){
                dirEntry.removeRecursively(function(entry){
                    console.debug("Directory deleted: " + dirName);
                    if(callback){
                        callback();
                    }
                }, function(error){
                    console.error("Failed to get file: " + dirName +
                                  ". errcode = " + error.code +
                                  ". error = " + this.getFileErrorMsg(error.code));
                });
            });
        }
    },

    /**
     * Delete a file from file system.
     * @param fileName The name of the file to delete.
     * @param dir The directory the file belongs to.
     * @param callback Function will be called when file is successfully deleted.
     */
    deleteFile: function(fileName, dir, callback){
        if(dir === undefined){
            console.warn("Target directory not defined: " + dir);
        }
        else{
            dir.getFile(
                fileName,
                {create: false, exclusive: false},
                $.proxy(function(fileEntry){
                    fileEntry.remove(
                        function(entry){
                            console.debug("File deleted: " + fileName);
                            if(callback){
                                callback();
                            }
                        },
                        $.proxy(function(error){
                            console.error("Failed to delete file: " + fileName +
                                          ". errcode = " + error.code +
                                          ". error = " + this.getFileErrorMsg(error.code));
                        }, this)
                    );
                }, this),
                $.proxy(function(error){
                    console.error("Failed to get file: " + fileName +
                                  ". errcode = " + error.code +
                                  ". error = " + this.getFileErrorMsg(error.code));
                }, this)
            );
        }
    },

    /**
    * Delete all files from a dir
    * @param localDir a DirectoryEntry to be cleared
    * @param success called after the recreation of the directory is finished
    * @param error called in case of error
    */
    deleteAllFilesFromDir: function(localDir, success, error){
        // easiest way to do this is to delete the directory and recreate it
        localDir.removeRecursively(
            $.proxy(function(){
                var getRelativePath = this.getRelativePath;
                this.getPersistentRoot(function(root){
                    var relPath = getRelativePath(root.fullPath, localDir.fullPath);

                    if(relPath === null){
                        utils.doCallback(error);
                        return;
                    }

                    root.getDirectory(
                        relPath,
                        {create: true, exclusive: false},
                        function(dir){
                            utils.doCallback(success, dir);
                        },
                        function(err){
                            console.error("Problem recreating the directory");
                            utils.doCallback(error);
                        }
                    );
                });
            }, this),
            function(err){
                console.error("Problem deleting directory");
                utils.doCallback(error);
            }
        );
    },

    /**
     * Find file inside a directory
     * @param {String} expr expression
     * @param {String} url of the directory
     * @returns {Object} a promise with the fileEntry if has been found
     */
    findFile: function(expr, targetUrl) {
        var deferred = new $.Deferred();

        this.resolveFileURL(targetUrl).done(function(dirEntry){
            var directoryReader = dirEntry.createReader();
            directoryReader.readEntries(function(entries){
                var res;
                for(var i=0; i<entries.length; i++){
                    if(utils.endsWith(entries[i].name, expr)){
                        res = entries[i];
                    }
                }
                deferred.resolve(dirEntry, res);
            });
        }).fail(function(error){
            deferred.reject(error);
        });

        return deferred.promise();
    },

    /**
     * Download file by file transfer.
     * @param source - the url of the file in the cloud
     * @param target - full path to the local file that transfer is saved to
     * @param success - function executed after success transfer. The FileEntry
     *                  is passed as an argument.
     * @param error - Optional function executed in the event of an error.
     */
    ftDownload: function(source, target, success, error) {
        console.debug('Download: ' + source + ' to ' + target);

        var _this = this;
        var ft = new FileTransfer();
        var match = source.match(/.*\/(.*)$/);
        var progressBar = utils.newDownloadProgressBar(match[1]);

        ft.onprogress = function(progressEvent) {
            var caption;
            var loaded;
            var total;

            loaded = progressEvent.loaded;
            total = progressEvent.total;

            if (progressEvent.lengthComputable) {
                caption = Math.round((loaded / total) * 100) + '%';
            }
            else {
                caption = progressEvent.loaded + ' bytes';
            }

            progressBar.progress(loaded, total, caption);
        };

        var onSuccess = function() {
            progressBar.done(2000);
            if (typeof success === 'function') {
                success.apply(null, arguments);
            }
        };

        var onError = function(err) {
            var errorMsg = _this.getFileTransferErrorMsg(err);
            var httpError = err.http_status; // jshint ignore:line
            progressBar.error('Error: ' + httpError + ' ' + errorMsg);

            if (typeof error === 'function') {
                error.apply(null, arguments);
            }
            else {
                console.error('Problem downloading file: ' + source +
                              ' to: ' + target +
                              ' error: ' + errorMsg +
                              ' http status: ' + httpError);
            }
        };

        progressBar.start();

        ft.download(encodeURI(source), target, onSuccess, onError, true);
    },

    /**
     * @param dir Directory on the device.
     * @return The full path of the directory.
     */
    getFilePath: function(dir){
        return dir.toURL();
    },

    /**
     * Resolve a FileEntry from a uri
     */
    resolveFileURL: function(fileURL) {
        var deferred = $.Deferred();

        window.resolveLocalFileSystemURL(fileURL, deferred.resolve, deferred.reject);

        return deferred.promise();
    },

    /**
     * @param dir Directory on the device.
     * @return The full path of the directory without 'file://'.
     */
    getFilePathWithoutProtocol: function(dir){
        return dir.toURL().replace("file://", "");
    },

   /**
    * @param error The error obj.
    * @return File error message as a string.
    */
    getFileErrorMsg: function(error){
        var msg;
        switch(error.code){
        case FileError.NOT_FOUND_ERR:
            msg = "Not Found";
            break;
        case FileError.SECURITY_ERR:
            msg = "Security Error";
            break;
        case FileError.ABORT_ERR:
            msg = "Abort Error";
            break;
        case FileError.NOT_READABLE_ERR:
            msg = "Not Readable";
            break;
        case FileError.ENCODING_ERR:
            msg = "Encoding Error";
            break;
        case FileError.NO_MODIFICATION_ALLOWED_ERR:
            msg = "No Modification Allowed";
            break;
        case FileError.INVALID_STATE_ERR:
            msg = "Invalid State";
            break;
        case FileError.SYNTAX_ERR:
            msg = "Syntax Error";
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = "Invalid Modification";
            break;
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = "Quaota Exceeded";
            break;
        case FileError.TYPE_MISMATCH_ERR:
            msg = "Type Mismatch";
            break;
        case FileError.PATH_EXISTS_ERR:
            msg = "Path Exists";
            break;
        default:
            msg = "Unknown Error: " + error.code;
        }

        return msg;
    },

    /**

     * @param error The error obj.
     * @return File error message as a string.
     */
    getFileTransferErrorMsg: function(error){
        var msg;
        switch(error.code){
        case FileTransferError.FILE_NOT_FOUND_ERR:
            msg = "File Not Found";
            break;
        case FileTransferError.INVALID_URL_ERR:
            msg = "Invalid URL";
            break;
        case FileTransferError.CONNECTION_ERR:
            msg = "Connection Error";
            break;
        case FileTransferError.ABORT_ERR:
            msg = "Abort Error";
            break;
        default:
            msg = "Unknown Error: " + error.code;
        }
        return msg;
    },

    /**
     * Get permanent root directory
     * @param callback function to be executed when persistent root is found
     * @return Persistent file system.
    */
    getPersistentRoot: function(callback){
        return getFileSystemRoot(callback, LocalFileSystem.PERSISTENT);
    },

    /**
     * @return The name of the root directory.
     */
    getRootDir: function(){
        return "edina";
    },

    /**
     * Get the relative path from one directory against its parent
     * @param parent directory
     * @param child directory it should be contained for the parent
     *
     * @return string with the relative path or null if the directories are not related
     */
    getRelativePath: function(parent, child){
        var nonBlank = function(el){
            return el !== "";
        };
        var parentParts = parent.split('/').filter(nonBlank);
        var childParts = child.split('/').filter(nonBlank);

        var relPath = [];
        for(var i=0; i<childParts.length; i++){
            if(i < parentParts.length){
                if(parentParts[i] !== childParts[i]){
                    console.error("Can't get relative path if parent doesn't contain child");
                    console.debug(parent);
                    console.debug(child);
                    return null;
                }
            }else{
                relPath.push(childParts[i]);
            }
        }

        return relPath.join('/');
    },

    /**
     * Get temporary root directory, this is secure and deleted if application is
     * uninstalled.
     * @param callback The function to be called when filesystem is retrieved.
     * @return Temporary file system.
     */
    getTemporaryRoot: function(callback){
        return getFileSystemRoot(callback, LocalFileSystem.TEMPORARY);
    },

    /**
     * Move a file to an new locaction.
     * @param options
     *   path - the full path to the original file.
     *   to - the target directory
     *   newName - rename the file
     *   success - success function, see FileEntry.moveTo
     *   error - optional error function
     */
    moveTo: function(options){
        if(options.error === undefined){
            options.error = function(error){
                var msg = 'Problem moving file: ' + error;
                console.error(msg);
                utils.inform(msg);
            };
        }

        var move = function(fileEntry){
            fileEntry.moveTo(
                options.to,
                options.newName,
                options.success,
                options.error
            );
        };

        if (typeof options.path === "string"){
            window.resolveLocalFileSystemURL(
                options.path,
                move,
                options.error
            );
        }
        else{
            move(options.path);
        }
    },

    /*
     * Read the content of a file entry as a json
     * @param baseFileEntry the base entry where to locate the file
     * @param filename the filename to read
     * @return Returns a promise that resolves to the content of the file as a json
     */
    readJSONFromFS: function(baseFileEntry, filename) {
        var deferred = $.Deferred();

        baseFileEntry.getFile(
            filename,
            null,
            function(fileentry) {
                var promise = _this.readTextFile(fileentry);
                var json;

                promise.done(function(data) {
                    try {
                        json = JSON.parse(data);
                    }
                    catch (ex) {
                        deferred.reject(ex);
                    }
                    deferred.resolve(json);
                });
            },
            function(err) {
                deferred.reject(err);
            });

        return deferred.promise();
    },

    /*
     * Read the content of a file entry as a text
     * @param fileEntry
     * @return Returns a promise that resolves to the content of a text file
     */
    readTextFile: function(fileEntry){
        var deferred = new $.Deferred();
        fileEntry.file(function(file) {
            var reader = new FileReader();

            reader.onloadend = function(e) {
                deferred.resolve(this.result);
            };

            reader.readAsText(file);
        }, function(err){
            deferred.reject(err);
        });

        return deferred.promise();
    },

    /**
     * Write string to file
     * @param options
     *   fileName - The new file name.
     *   data - The new file content.
     *   dir - Create file in this directory.
     */
    writeToFile: function(options){
        var deferred = new $.Deferred();
        options.dir.getFile(
            options.fileName,
            {create: true, exclusive: false},
            function(fileEntry){
                fileEntry.createWriter(
                    function(writer){
                        writer.onwrite = function(evt) {
                            console.debug('File ' + options.fileName +
                                          ' written to ' + options.dir.fullPath);
                            deferred.resolve();
                        };
                        writer.write(options.data);
                    },
                    function(error){
                        console.error("Failed to write to file:" + options.fileName +
                                      ". errcode = " + error.code);
                        deferred.reject(error);
                    }
                );
            },
            function(error){
                console.error(error + " : " + error.code);
                console.error("Failed to create file: " + options.fileName +
                              ". " + _this.getFileErrorMsg(error));
                deferred.reject(error);
            }
        );

        return deferred.promise();
    }
};

var _this = {};
var _android = {
    /**
     * @return Get app root name. For android make sure the directory is deleted
     * when the app is uninstalled.
     */
    getRootDir: function(){
        return "Android/data/" + utils.getPackage();
    },
};

var _ios = {
    /**
     * @param dir Directory on the device.
     * @return The full path of the directory for iOS.
     */
    getFilePath: function(dir){
        return this.getFilePathWithoutProtocol(dir);
    },
};

if(utils.isIOSApp()){
    $.extend(_this, _base, _ios);
}
else{
    $.extend(_this, _base, _android);
}

return _this;
});
