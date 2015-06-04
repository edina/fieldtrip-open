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

/* global equal, expect, test  */

define(['records'], function(records) {
    var data = [
        {name: 'test1', editor: 'one.edtr', coordinates: [-3.186861, 55.941985]},
        {name: 'test2', editor: 'two.edtr', coordinates: [-3.185070, 55.941397]},
        {name: 'test3', editor: 'two.edtr', coordinates: [-3.185744, 55.940883]},
        {name: 'test4', editor: 'two.edtr', coordinates: [-3.187450, 55.941443]}
    ];

    var run = function() {
        module("Records", {
            setup: function() {
                var datum;
                var annotations = {};

                records.clearSavedRecords();

                for (var i = 0, len = data.length - 1; i < len; i++) {
                    datum = data[i];
                    annotations[datum.name] = records.createRecord(datum.editor);
                    annotations[datum.name].name = datum.name;
                    annotations[datum.name]
                        .record.geometry.coordinates = datum.coordinates;
                }
                console.debug(annotations);
                records.setSavedRecords(annotations);
            }
        });

        test('test records count', function() {
            expect(1);
            var annotations = records.getSavedRecords();
            equal(Object.keys(annotations).length, 3);
        });

        test('create annotation', function() {
            expect(1);
            var datum = data[3];
            var record;
            var annotations;

            record = records.createRecord(datum.editor);
            records.saveAnnotation(datum.name, record);
            annotations = records.getSavedRecords();

            equal(Object.keys(annotations).length, 4);
        });

        test('test records filter', function() {
            expect(1);

            var filterFunc = function(annotation) {
                if (annotation.record.properties.editor === 'two.edtr') {
                    return true;
                }
                else {
                    return false;
                }
            };

            var annotations = records.getSavedRecords(filterFunc);

            // there are two annotations with a two.edtr editor
            equal(Object.keys(annotations).length, 2);
        });
    };

    return {run: run};
});
