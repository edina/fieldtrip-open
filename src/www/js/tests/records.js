"use strict";
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

    return {run: run}
});
