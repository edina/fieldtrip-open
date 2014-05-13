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

/* global equal, expect, test  */

define(['records'], function(records) {

    var run = function() {
        module("Records", {
            setup: function(){
                records.clearSavedRecords();
                var annotations = {
                    "1": {
                        "record":{
                            "name": "one",
                            "editor": "one.edtr"
                        }
                    },
                    "2": {
                        "record":{
                            "name": "two",
                            "editor": "two.edtr"
                        }
                    },
                    "3": {
                        "record":{
                            "name": "three",
                            "editor": "two.edtr"
                        }
                    },
                    "4": {
                        "record":{
                            "name": "four",
                            "editor": "two.edtr"
                        }
                    }
                };

                records.setSavedRecords(annotations);
            }
        });

        test('test records count', function(){
            expect(1);
            var annotations = records.getSavedRecords();
            //console.log(annotations);
            equal(Object.keys(annotations).length, 4);
        });

        test('test records filter', function(){
            expect(1);
            var annotations = records.getSavedRecords(function(annotation){
                if(annotation.record.editor === 'two.edtr'){
                    return true;
                }
                else{
                    return false;
                }
            });

            // there are three annotations with a two.edtr editor
            equal(Object.keys(annotations).length, 3);
        });
    };

    return {run: run};
});
