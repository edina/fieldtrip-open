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
    * create Directory
    * @param dirName directory name that needs to be created
    * @param callback Function will be called when dir is successfully created.
    */
    createDir: function(dirName, callback){
        this.getPersistentRoot(function(root){
            root.getDirectory(
                dirName,
                {create: true, exclusive: false},
                function(dir){
                    callback(dir);
                },
                function(error){
                    utils.inform('Failed finding assets directory. Saving will be disabled: ' + error);
                });
        });
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
                function(fileEntry){
                    fileEntry.remove(
                        function(entry){
                            console.debug("File deleted: " + fileName);
                            if(callback){
                                callback();
                            }
                        },
                        function(error){
                            console.error("Failed to delete file: " + fileName +
                                          ". errcode = " + error.code +
                                          ". error = " + this.getFileErrorMsg(error.code));
                        }
                    );
                },
                function(error){
                    console.error("Failed to get file: " + fileName +
                                  ". errcode = " + error.code +
                                  ". error = " + this.getFileErrorMsg(error.code));
                }
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
    * fileTransfer, function for transferring file to the app
    * @param source the url of the file in the cloud
    * @param the local file that is saved to
    */
    fileTransfer: function(source, target, callback){

        console.debug("download: " + source + " to " + target);
        var ft = new FileTransfer();

        ft.onprogress = $.proxy(function(progressEvent) {
            if (progressEvent.lengthComputable) {
                utils.inform(Math.round((progressEvent.loaded / progressEvent.total)*100) + "%");
            }
        }, this);

        ft.download(
            encodeURI(source),
            target,
            $.proxy(function(entry) {
                console.debug("download complete: ");
                callback(true, entry);
            }, this),
            $.proxy(function(error) {
                // if this fails first check whitelist in cordova.xml
                utils.informError("Problem syncing " + name);
                console.error("Problem downloading asset: " + error.source +
                    " to: " + error.target +
                    " error: " + this.getFileTransferErrorMsg(error) +
                    "http status: " + error.http_status);// jshint ignore:line
                callback(false);
            }, this)
        );
    },

    /**
     * @param dir Directory on the device.
     * @return The full path of the directory iOS format
     */
    getFilePath: function(dir){
        return dir.toURL().replace("file://", "");
    },

    /**
     * @param dir Directory on the device.
     * @return The full path of the directory.
     */
    getFilePathWithoutStart: function(dir){
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
     * Write string to file
     * @param fileName The new file name.
     * @param data The new file content.
     * @param dir Optional directory object.
     * @param callback The function that is executed when file has finished writing.
     */
    writeToFile: function(options, dir, callback){
        dir.getFile(
            options.fileName,
            {create: true, exclusive: false},
            function(fileEntry){
                fileEntry.createWriter(
                    function(writer){
                        writer.onwrite = function(evt) {
                            console.debug('File ' + options.fileName +
                                          ' written to ' + dir.fullPath);
                            if(callback){
                                callback();
                            }
                        };
                        writer.write(options.data);
                    },
                    function(error){
                        console.error("Failed to write to file:" + options.fileName +
                                      ". errcode = " + error.code);
                    }
                );
            },
            function(error){
                console.error(error + " : " + error.code);
                console.error("Failed to create file: " + options.fileName +
                              ". " + _this.getFileErrorMsg(error));
            }
        );
    }
};

var _this = {};
var _android = {
    /**
     * @param dir Directory on the device.
     * @return The full path of the directory Android format
     */
    getFilePath: function(dir){
        return dir.toURL();
    },

    /**
     * @return Get app root name. For android make sure the directory is deleted
     * when the app is uninstalled.
     */
    getRootDir: function(){
        return "Android/data/" + utils.getPackage();
    },
};

if(utils.isIOSApp()){
    _this = _base;
}
else{
    $.extend(_this, _base, _android);
}

return _this;
});