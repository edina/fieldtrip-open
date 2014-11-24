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

define(["records", "map", "file", "utils"], function(// jshint ignore:line
    records, map, file, utils){

    var createRecords = function(callback){
        var created = 0;
        var number = 0;

        var copyTestFile = function(fileName, cb){
            utils.inform("Copying test image");
            // copy test.jpg as new file based on guid
            _this.testDir.getFile(
                'test.jpg',
                {create: true, exclusive: false},
                function(entry){
                    entry.copyTo(
                        _this.testDir,
                        fileName + '.jpg',
                        function(newEntry){
                            console.debug("New Path: " + newEntry.fullPath);
                            cb(fileName, newEntry);
                        },
                        function(error){
                            console.error("File copy failed: " + error.code);
                        }
                    );
                },
                function(error){
                    console.error("Test file get failed: " + error.code);
                }
            );
        };

        var createNewRecord = function(fileName, newEntry){
            var name = 'test-record';
            var unique = $('#home-test-create-records-popup-unique').is(':checked');
            if(unique){
                name = name + "-" + fileName;
            }
            console.debug("Create record " + name + " with image id: " + fileName);
            var annotation = {
                "record": {
                    'editor': 'image.edtr',
                    'name': name,
                    'fields': []
                },
                "type": "image",
                "isSynced": false
            };

            utils.inform("Create " + name);

            annotation.record.fields.push({
                "id": "fieldcontain-image-1",
                "val": file.getFilePath(newEntry)
            });
            records.saveAnnotationWithCoords(
                annotation,
                map.toInternal(new OpenLayers.LonLat(-2.421976, 53.825564))
            );
            ++created;

            if(created === number){
                setTimeout(function(){
                    $('body').pagecontainer('change', 'saved-records.html');
                }, 500);
            }
        };

        fetchTestImage(function(){
            $('#home-test-create-records-popup-confirm').off('vmousedown');
            $('#home-test-create-records-popup-confirm').on(
                'vmousedown',
                function(){
                    number = parseInt($('#home-test-create-records-popup-number').val());
                    for(var i = 0; i < number; i++){
                        var fileName = $.guid++;
                        copyTestFile(fileName, createNewRecord);
                    }
                    $('#home-test-create-records-popup').popup('close');
                }
            );
            $('#home-test-create-records-popup').popup('open');
        });
    };

    var fetchTestImage = function(callback){
        var fileName = "test.jpg";
        _this.testDir.getFile(
            fileName,
            {create: false, exclusive: true},
            function(){
                // test file is there
                callback();
            },
            function(){
                // test not found download it
                file.fileTransfer(
                    'http://devel.edina.ac.uk:3333/test/' + fileName,
                    _this.testDir.toURL() + fileName,
                    function(success){
                        callback();
                    }
                );
            }
        );
    };

var _this = {
    init: function(testDir){
        this.testDir = testDir;
    },
    createRecords: createRecords
};

return _this;

});
