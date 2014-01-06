PAGE_TO_LOAD = 200;
INTERVAL_POLL = 200;

var testing;

function Testing(options){
    this.isMobileApp = typeof(device) !== 'undefined';

    this.allTests = [
        new MapTests({
            map: options.map,
            cache: options.cache
        }),
        new Records({
            map: options.map,
            annotations: options.annotations,
            storage: options.map.storage,
            settings: options.settings
        })
    ]
};

Testing.prototype.run = function(test, method){
    // loop round all defined tests
    for(var name in this.allTests){
        var testObj = this.allTests[name];
        if(name === 'remove'){
            continue;
        }

        // define setup and teardown methods
        module(testObj.name, {
            setup: function() {
                if(typeof(testObj.setup) !== 'undefined'){
                    testObj.setup();
                }
            },
            teardown: function() {
                if(typeof(testObj.teardown) !== 'undefined'){
                    testObj.teardown();
                }
            }
        });

        // perform each test defined in object
        for(var prop in testObj){
            if(prop.substring(0, 4) === "test"){
                if (!this.isMobileApp && testObj[prop].mobileOnly){
                    // mobile specific test shouldn't be performed on non mobile app
                    continue;
                }
                asyncTest(prop, $.proxy(testObj[prop], testObj));
            }
        }
    }
};

function MapTests(options){
    this.map = options.map;
    this.cache = options.cache;
};

// test geo locate option
MapTests.prototype.testLocate = function(){
    goToMap($.proxy(function() {
        var LON = 0;
        var LAT = 0;
        var lonlat = new OpenLayers.LonLat(LON, LAT);
        var ng = toNationalGrid(lonlat);
        this.map.updateLayer(this.map.getLocateLayer(),
                             Map.USER_POSITION_ATTR,
                             Map.POST_LOCATE_ZOOM_TO,
                             ng);

        equal(Math.round(this.map.getLocateCoords().lon), lonlat.lon, 'Locate lon position reset');
        equal(Math.round(this.map.getLocateCoords().lat), lonlat.lat, 'Locate lat position reset');

        // click on locate and test if position changes
        this.map.geolocateTimeout = 2000;
        $('.user-locate').click();
        var timer = setInterval($.proxy(function() {
            lonlat = this.map.getLocateCoords();
            if(lonlat.lon !== LON && lonlat.lat !== LAT){
                ok(true, 'Geo Position located');
                clearInterval(timer);
                start();
            }
        }, this), INTERVAL_POLL);
    }, this));
};

// test map search
MapTests.prototype.testSearch = function(){
    var orgLonLat = this.map.getCentre(true);

    goToMap($.proxy(function() {
        $('.map-search').click();

        changePageCheck('#search-page', $.proxy(function(){
            $('#searchterm').val('Glenro');
            e = $.Event('keyup');
            e.keyCode = 8;
            $('#searchterm').trigger(e);
            intervalTest({
                'id': '#searchterm',
                'test': function(){
                    if($('#search-results li').length > 0){
                        return true;
                    }
                },
                'cb': $.proxy(function(){
                    $($('#search-results li').get(1)).click();
                    changePageCheck('#map-page', $.proxy(function(){
                        var lonLat = this.map.getCentre(true).centre;
                        notEqual(orgLonLat.lon, lonLat.lon, 'Compare longitude with old');
                        notEqual(orgLonLat.lat, lonLat.lat, 'Compare latitude with old');
                        equal(lonLat.lon.toFixed(2), -3.17, 'Glenrothes centre longitude');
                        equal(lonLat.lat.toFixed(2), 56.2, 'Glenrothes centre latitude');
                        start();
                    }, this));
                }, this)
            });
        }, this));
    }, this));
};

// test save map
MapTests.prototype.testSaveMap = function(){
    var that = this;
    var savedMaps = this.cache.getSavedMaps();

    if(savedMaps !== undefined){
        if(this.cache.getSavedMapsCount() === 3){
            // delete one of the maps
            $.each(this.cache.getSavedMaps(), function(name, map){
                console.debug("delete " + name);
                that.cache.deleteSavedMapDetails(name);
                return;
            })
        }
    }
    var mapCount = this.cache.getSavedMapsCount();

    changePageByFile('save-map.html', '#save-map', function(){
        ok( true, 'todo');

        clickAndTest({
            'id': '#save-map-buttons-ok',
            'test': function(){
                return $('#cache-controls').is(':visible');
            },
            'cb': function(success){
                ok(success, 'Save button');
                clickAndTest({
                    'id': '#cache-save-details-button-div a',
                    'test': function(){
                        return $.mobile.activePage[0].id === 'save-map-name-dialog';
                    },
                    'cb': function(success){
                        ok(success, 'Map name dialog');
                        clickAndTest({
                            'id': '#saved-map-name-dialog-btn',
                            'delay': 2500,
                            'poll': 1000,
                            'test': function(){
                                // test has passed when map count has been incremented
                                return (mapCount + 1)  === that.cache.getSavedMapsCount();
                            },
                            'cb': function(success){
                                ok(success, 'Save Map');
                                start();
                            }
                        });
                    }
                });

            }
        });
    });
};
MapTests.prototype.testSaveMap.mobileOnly = true;


function Records(options){
    this.map = options.map;
    this.annotations = options.annotations;
    this.storage = options.storage;
    this.settings = options.settings;
};

Records.prototype.addRecord = function(description, cb){
    goToTextRecordPage($.proxy(function(){
        // save annotation
        $('#form-textarea-1').val(description);
        $('input[value=Save]').click();

        changePageCheck('#annotate-preview-page', $.proxy(function(){
            intervalTest({
                'id': 'annotatecoords',
                'test': $.proxy(function(){
                    return typeof(this.map.getAnnotationCoords(false)) !== 'undefined';
                }, this),
                'cb': $.proxy(function(){
                    $('input[value=Save]').click();
                    changePageCheck('#map-page', function(){
                        cb();
                    });
                }, this),
                'attempts': 100
            });
        }, this));
    }, this));
};

Records.prototype.login = function(cb){
    var allowStr = 'document.querySelector(\'input[name="allow_access"]\').click();';
    var loginStr = 'if(document.getElementById("login_email")){document.getElementById("login_email").value="george.hamilton@ed.ac.uk";document.getElementById("login_password").value="un5afe";document.querySelector(\'input[type="submit"]\').click();}else{}';

    this.annotations.cloudLogin(
        $.proxy(function(){
            console.debug("Logged into Dropbox");
            cb();
        }, this),
        function(cbrowser){
            setTimeout(function(){
                cbrowser.executeScript(
                    {
                        code: loginStr
                    },
                    function(){
                        setTimeout(function(){
                            cbrowser.executeScript(
                                {
                                    code: allowStr
                                },
                                function(){}
                            );
                        }, 3000); // wait for authorise page
                    }
                );
            }, 3000); // wait for child browser to load
        }
    );
};

Records.prototype.logout = function(cb){
    goHome(function(){
        if($('#home-content-login p').text() === 'Login'){
            cb();
        }
        else{
            clickAndTest({
                'id': '#home-content-login a',
                'test':function(){
                    if($('#home-content-login p').text() === 'Login'){
                        return true;
                    }
                },
                'cb': function(success){
                    ok(success, 'Logout of dropbox');
                    cb();
                }
            });
        }
    });
};

// test saving a GPS track
Records.prototype.testGPSTrack = function(){
    var that = this;

    var doTest = function(){
        var count = that.recordCount();
        changePageByFile('annotate-gps.html', '#annotate-gps-page', function(){
            clickAndTest({
                'id': '#annotate-gps-form-ok',
                'test':function(){
                    console.log($.mobile.activePage[0].id);
                    return $.mobile.activePage[0].id === 'gpscapture-page';
                },
                'cb': function(success){
                    ok(success, 'Go to GPS catture page');
                    that.map.setCentre(-3.187975, 55.936933, undefined, true);
                    Utils.inform('Be patient');

                    intervalTest({
                        'id': 'track point count',
                        'test': function(){
                            var track = that.map.getGPSTrackLayer().features[0];
                            return track.geometry.components.length > 2;
                        },
                        'cb': function(){
                            console.log("stop");

                            clickAndTest({
                                'id': '#gpscapture-stop-button',
                                'test': function(){
                                    return $('#gpscapture-confirm-popup').is(':visible');
                                },
                                'cb': function(){
                                    console.log('save');
                                    clickAndTest({
                                        'id': '#gpscapture-confirm-save',
                                        'test': function(){
                                            return that.recordCount() === (count + 1);
                                        },
                                        'cb': function(){
                                            console.log('save');
                                            start();
                                            ok(true, 'Track saved as record')
                                        }
                                    });
                                }
                            });
                        },
                        'poll': 2000
                    });
                }
            });
        });
    };

    if(!this.settings.debugGPS()){
        changePageByFile('settings.html', '#settings-page', function(){
            setTimeout(function(){
                Utils.sliderVal('#settings-debug-gps', true);
                doTest();
            }, 2000);
        });
    }
    else{
        doTest();
    }
};

// test simple text annotation
Records.prototype.testTextRecord = function(){
    var count = this.recordCount();
    this.addRecord('test text annotation description', $.proxy(function(){
        var newCount = this.recordCount();
        // check local annotations count is incremented
        equal(newCount, count + 1, 'New record has been created');
        start();
    }, this));
};

// test syncing
Records.prototype.testSync = function(){
    var that = this;
    var doSync = function(){
        // login to dropbox
        that.login(function(){
            // add new text record
            that.addRecord('test sync', function(newCount){
                goToRecordsPage(function(){

                    // click on sync button
                    $('#saved-annotations-page-header-login-sync').mousedown();

                    intervalTest({
                        'id': '#saved-annotations-page-header-login-sync',
                        'poll': 1000,
                        'delay': 1000,
                        'test': function(){
                            return ($('#saved-annotation-sync-popup div').length > 0);
                        },
                        'cb': function(success){
                            ok(success, 'start sync');
                            //$('a.sync-confirm').click();
                            $('a.sync-confirm').mousedown();

                            // force close of popup
                            //$('#saved-annotation-sync-popup').popup('close');

                            intervalTest({
                                'id': 'sync-confirm',
                                'test': function(){
                                    // sync is complete when cursor is saved
                                    return that.storage.getCloudLogin().cursor !== undefined;
                                },
                                'cb': function(success){
                                    ok(success, 'sync complete');
                                    start();
                                },
                                'attempts': 1000,
                                'poll': 1000
                            })
                        }
                    });
                });
            })
        });
    }

    this.annotations.cloudCheckUser(function(state){
        if(state === 1){
            that.logout(function(){
                doSync();
            });
        }
        else{
            doSync();
        }
    });
};
Records.prototype.testSync.mobileOnly = true;

Records.prototype.recordCount = function(){
    return this.annotations.getSavedAnnotationsCount();
};

function goHome(cb){
    changePageByFile('index.html', '#home-page', cb);
};

function goToTextRecordPage(cb){
    goHome(function(){
        $('a.annotate-text-form').mousedown();

        changePageCheck('#annotate-page', function(){
            setTimeout(function(){
                cb();
            }, 1000); // allow annotate page time to initialise
        });
    });
};

function goToRecordsPage(cb){
    changePageByFile('saved-annotations.html', '#saved-annotations-page', cb);
};

function goToTestPage(cb){
    goHome(function(){
        var id = '#test-page';
        $.mobile.changePage(id);
        changePageCheck(id, cb);
    });
};

function goToMap(cb){
    changePageByFile('map.html', '#map-page', cb);
};


function clickSettings(cb){
    changePageByFile(SETTINGS_PAGE, UI.SETTINGS_PAGE_ID, cb);
};


function changePageByFile(page, target, cb){
    $.mobile.changePage(page);
    return changePageCheck(target, cb);
};

function changePageCheck(id, cb){
    var count = 0;
    var timer = setInterval(function() {
        if(count > 15){
            console.error(id + " not found");
            clearInterval(timer);
            ok(false, id + " not found");
            cb();
        }
        else if('#' + $($.mobile.activePage).attr('id') === id){
            clearInterval(timer);
            cb();
        }
        else{
            console.debug('Waiting for ' + id);
        }

        ++count;
    }, INTERVAL_POLL);
};

function clickAndTest(options){
    var delay = 0; // delay before doing click
    if(typeof(options.delay) !== 'undefined'){
        delay = options.delay;
    }

    setTimeout(function(){
        $(options.id).click();
        intervalTest(options);
    }, delay);
};


function intervalTest(options){
    var count = 0; // running count of attempts
    var attempts = 20; // max number of attempts
    var poll = INTERVAL_POLL; // poll interval between attempts

    if(typeof(options.attempts) !== 'undefined'){
        var attempts = options.attempts;
    }
    if(typeof(options.poll) !== 'undefined'){
        poll = options.poll;
    }

    var timer = setInterval(function() {
        if(options.test()){
            ok(true, 'Element ' + options.id + ' found');
            clearInterval(timer);
            options.cb(true);
        }
        else{
            if(count > attempts){
                ok(false, 'Timeout for ' + options.id);
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


function initTests(options){
    testing = new Testing(options);
    for(var i in testing.allTests){
        if(i === 'remove'){
            continue;
        }

        var obj = testing.allTests[i];
        var test = obj.constructor.name;

        $('#qunit-tests-list').append('<li data-autodividers="true">' + test + '</li>')
        for(var method in obj){
            if(!testing.isMobileApp && obj[method].mobileOnly){
                continue
            }
            if(method.substr(0, 4) === 'test'){
                $('#qunit-tests-list').append('<li><a href="#" class="qunit-single-test" test="' + test + '" method="' + method + '">' + method + '</a></li>');
            }
        }
    }

    $('#qunit-tests-list').listview('refresh');

    $('#test-page-runall').unbind();
    $('#test-page-runall').on('click', function(){
        cleanTestPage();
        testing = new Testing(options);
        testing.run();
    });

    $('#test-page-restart').unbind();
    $('#test-page-restart').on('click', function(){
        cleanTestPage();
        initTests(options);
    });

    $('.qunit-single-test').unbind();
    $('.qunit-single-test').on('click', function(){
        runSingleTest($(this).attr('test'),
                      $(this).attr('method'));
    });
};

function runSingleTest(test, method){
    for(var i in testing.allTests){
        var obj = testing.allTests[i];
        if(obj.constructor.name === test){
            for(var func in obj){
                if(func === method){
                    cleanTestPage();
                    asyncTest(test + " : " + func, $.proxy(obj[func], obj));
                    break;
                }
            }
            break;
        }
    }
};

function cleanTestPage(){
    $('#qunit-tests-list li').remove();
    $('#qunit-tests li').remove();
};

QUnit.done(function( details ) {
    goToTestPage(function(){
        console.debug("Return to test page");

        // stop default qunit reun behaviour
        $.each($('#qunit-tests a'), function(i, anchor){
            $(anchor).attr('href', '#');
        });

        // rerun test listeners
        $('#qunit-tests a').click(function(){
            var text = $($(this).prev().find('[class="test-name"]').get(0)).text().split(':');
            var test = text[0].trim();
            var method = text[1].trim();
            runSingleTest(test, method);
        });
    });
});
