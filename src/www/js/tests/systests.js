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

/* global asyncTest, equal, ok, start */

define(['QUnit', 'map', 'records'], function(QUnit, map, records){
    var INTERVAL_POLL = 200;

    var addRecord = function(description, cb){
        goToTextRecordPage(function(){
            // save annotation
            $('#form-textarea-1').val(description);
            $('input[value=Save]').click();

            changePageCheck('#annotate-preview-page', function(){
                intervalTest({
                    'id': 'annotatecoords',
                    'test': function(){
                        return typeof(map.getAnnotationCoords(false)) !== 'undefined';
                    },
                    'cb': function(){
                        $('input[value=Save]').click();
                        changePageCheck('#map-page', function(){
                            cb();
                        });
                    },
                    'attempts': 100
                });
            });
        });
    };

    var changePageCheck = function(id, cb){
        var count = 0;
        var timer = setInterval(function() {
            if(count > 15){
                console.error(id + " not found");
                clearInterval(timer);
                ok(false, id + " not found");
                cb();
            }
            else if('#' + $('body').pagecontainer('getActivePage').get(0).id === id){
                clearInterval(timer);
                if(cb){
                    cb();
                }
            }
            else{
                console.debug('Waiting for ' + id);
            }

            ++count;
        }, INTERVAL_POLL);
    };

    var changePageByFile = function(page, target, cb){
        $('body').pagecontainer('change', page);
        return changePageCheck(target, cb);
    };

    var triggerAndTest = function(eventName, options){
        var delay = 0; // delay before doing click
        if(typeof(options.delay) !== 'undefined'){
            delay = options.delay;
        }

        setTimeout(function(){
            $(options.id).trigger(eventName);
            intervalTest(options);
        }, delay);
    };

    var complete = function(){
        goHome(function(){
            var id = '#test-page';
            $('body').pagecontainer('change', id);
            changePageCheck(id, function(){
                start();
            });
        });
    };

    var goHome = function(cb){
        changePageByFile('index.html', '#home-page', function(){
            cb();
        });
    };

    var goToMap = function(cb){
        changePageByFile('map.html', '#map-page', cb);
    };

    var goToTextRecordPage = function(cb){
        goHome(function(){
            $('a.annotate-text-form').mousedown();

            changePageCheck('#annotate-page', function(){
                setTimeout(function(){
                    cb();
                }, 1000); // allow annotate page time to initialise
            });
        });
    };

    var intervalTest = function(options){
        var count = 0; // running count of attempts
        var attempts = 20; // max number of attempts
        var poll = INTERVAL_POLL; // poll interval between attempts

        if(typeof(options.attempts) !== 'undefined'){
            attempts = options.attempts;
        }
        if(typeof(options.poll) !== 'undefined'){
            poll = options.poll;
        }

        var timer = setInterval(function() {
            if(options.test()){
                //ok(true, 'Element ' + options.id + ' found');
                clearInterval(timer);
                options.cb(true);
            }
            else{
                if(count > attempts){
                    //ok(false, 'Timeout for ' + options.id);
                    clearInterval(timer);
                    options.cb(false);
                }
                else{
                    console.debug('Waiting for ' + options.id);
                    ++count;
                }
            }
        }, poll);
    };

    var tests = {
        'Geo Locate': function(){
            goToMap(function(){
                var LON = 0;
                var LAT = 0;
                var lonlat = new OpenLayers.LonLat(LON, LAT);
                var ng = map.toInternal(lonlat);
                map.updateLayer({
                    layer: map.getLocateLayer(),
                    id: map.USER_POSITION_ATTR,
                    zoom: map.POST_LOCATE_ZOOM_TO,
                    lonLat: ng
                });
                equal(Math.round(map.getLocateCoords().lon), lonlat.lon, 'Locate lon position reset');
                equal(Math.round(map.getLocateCoords().lat), lonlat.lat, 'Locate lat position reset');

                // click on locate and test if position changes
                map.geolocateTimeout = 2000;
                $('.user-locate').click();
                var timer = setInterval(function() {
                    lonlat = map.getLocateCoords();
                    if(lonlat.lon !== LON && lonlat.lat !== LAT){
                        ok(true, 'Geo Position located');
                        clearInterval(timer);
                        complete();
                    }
                }, INTERVAL_POLL);
            });
        },
        'Save Text Record': function(){
            var count = records.getSavedRecordsCount();
            addRecord('test text annotation description', function(){
                var newCount = records.getSavedRecordsCount();
                // check local annotations count is incremented
                equal(newCount, count + 1, 'New record has been created');
                complete();
            });
        }
    };

    var run = function(toRun) {
        module("System Tests");
        $.each(tests, function(name, test){
            // if no filter is defined always run test
            if(toRun === undefined || name === toRun){
                asyncTest(name, test);
            }
        });

        $.getJSON('theme/project.json', function(f){
            var fieldtrip = f.plugins.fieldtrip;
            var noOfPlugins = Object.keys(fieldtrip).length;

            if(noOfPlugins > 0){
                $.each(fieldtrip, function(name){
                    require(["plugins/" + name + "/js/tests.js"], function(tests){
                        console.debug(name + " tests loaded");
                        if(tests && tests.sys){
                            if(toRun === undefined || name === toRun){
                                //asyncTest(name, test);
                                tests.sys.run();
                            }
                        }
                    });
                });
            }
        });
    };

return {
    tests: tests,
    run: run,
    addRecord: function(desc, cb){
        addRecord(desc, cb);
    },
    complete: function(){
        complete();
    },
    clickAndTest: function(options){
        triggerAndTest('click', options);
    },
    tapAndTest: function(options){
        triggerAndTest('tap', options);
    },
    changePageByFile: function(page, target, cb){
        changePageByFile(page, target, cb);
    },
    changePageCheck: function(id, cb){
        changePageCheck(id, cb);
    },
    goHome: function(cb){
        goHome(cb);
    },
    goToMap: function(cb){
        goToMap(cb);
    },
    goToRecordsPage: function(cb){
        changePageByFile('saved-records.html', '#saved-records-page', cb);
    },
    intervalTest: function(options){
        intervalTest(options);
    },
    runSingleTest: function(name){
        run(name);
    },
};

});
