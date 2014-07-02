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

define(['utils'], function(utils){

    return {
        /**
        * create Directory
        * @param dirName directory name that needs to be created
        * @param callback Function will be called when dir is successfully created.
        */
        createDir: function(dirName, callback){
            utils.getPersistentRoot(function(root){
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
        * Delete all files from a dir
        * @param localDir that items will be removed from
        * @param dirName The directory that needs to be empty.
        * @param callback Function will return a dir value if file is successfully deleted
        * otherwise undefined.
        */
        deleteAllFilesFromDir: function(localDir, dirName, callback){
            // easiest way to do this is to delete the directory and recreate it
            localDir.removeRecursively(
                function(){
                    utils.getPersistentRoot(function(root){
                        root.getDirectory(
                            dirName,
                            {create: true, exclusive: false},
                            function(dir){
                                callback(dir);
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
                    callback(true);
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
        }
    };
});