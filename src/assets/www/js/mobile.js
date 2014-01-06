"use strict";

var Utils;
var homepageDisplay;
var webdb;
var cacheTests;
var moreTests;

/**
 * Dom is ready.
 */
$(function() {
    if (window.location.href.substr(0, 4) === 'http'){
        onDeviceReady();
    }
    else{
        document.addEventListener("deviceready", onDeviceReady, false);
    }
});

/**
 * Device is ready for application to be initialised.
 */
function onDeviceReady(){
    webdb = getWebDatabase();

    if(typeof(webdb) !== 'undefined'){

        if(localStorage.getItem(webdb.DATABASE_CREATED) !== "true"){
            webdb.createTablesIfRequired();
        }

        /*** code below to be removed when version 1.2.7 (22) and less is no longer used ***/

        //remove old local storage files and map files if upgrading versions

        var oldVersionExists = localStorage.getItem(Cache.SAVED_MAPS_VERSION_1);

        if(oldVersionExists){

            localStorage.removeItem(Cache.SAVED_MAPS_VERSION_1);

            for (var i = 0, j = localStorage.length; i < j; i++){
                var key = localStorage.key(i);

                if(key && key.length > 4 && key.substring(0,4) === 'http'){
                    //delete ref to old cached images
                    localStorage.removeItem(key);
                }

            }


            window.requestFileSystem(
                LocalFileSystem.PERSISTENT,
                0,
                function(fileSystem){
                    fileSystem.root.getDirectory(
                        "edina/cache",
                    {create: false},
                    function(cacheDir){
                        var success = function (parent) {
                            console.log("Remove Recursively Succeeded");
                        }
                        var fail = function(error) {
                            console.log("Remove Recursively Failed" + error.code);
                        }
                        cacheDir.removeRecursively(success, fail);
                    },
                    function(error){
                        console.log('Failed finding root directory. No need to delete cache directory.');
                    });
                },
                function(error){
                    alert('Failed to get file system:' + error);
            });

            /***** to be removed end *****/
        }
    }

    var isMobileApp = typeof device !== 'undefined';
    var isIOSApp;
    var cache, rootDir;
    var db = new Storage();
    var settings = new Settings({db: db});

    Utils = initUtils(isMobileApp, settings);
    homepageDisplay = initHomepageDisplay();
    deviceDependent.init(Utils.isIOSApp());

    // openlayers map must be initialised when device is ready
    var map = new Map({db: db, isMobileApp: isMobileApp});

    if(isMobileApp){
        cache = new FileSystemCache({map: map,
                                     db: db});
    }
    else{
        // desktop browser
        if(Utils.supportsToDataURL()){
            cache = new Cache({map: map, db: db});
        }
    }

    var options = {
        settings: settings,
        map: map,
        cache: cache,
        isMobileApp: isMobileApp,
        annotations: new Annotations({map: map,
                                      isMobileApp: isMobileApp})};
    var ui;

    if(Utils.isIOSApp()){
        //load custom js and css for ios
        $('head').append('<link rel="stylesheet" href="css/ios.style.css" />');

        $.getScript('js/mobile.ios.js', function() {  ui = new IosUI(options);
                                                      ui.init();

                                                    });
    }
    else {
        ui = new UI(options) ;
        ui.init();
    };




    if(!isMobileApp || Utils.isIOSApp()){
        // replace with no-op - functions not required for ios or desktop
        plugins.SoftKeyBoard.hide = function (){};
        Utils.touchScroll = function (){};
    }

    console.debug('Set up complete');
};


/**
 * UI is the main class for controlling user interaction with the app.
 * @param options - properties object:
 *     annotations - points of interest object
 *     map         - openlayers map wrapper
 *     cache       - map tile saving object
 *     storage     - HTML5 local storage wrapper
 *     settings    - application preferences object
 *     isMobileApp - is this being run within a native app?
 */
function UI(options) {
    // switch off transitions until they work properly
    $.mobile.defaultPageTransition = 'none';

    this.annotations = options.annotations;
    this.map = options.map;
    this.cache = options.cache;
    this.isMobileApp = options.isMobileApp;
    this.db = this.map.storage;
    this.settings = options.settings;

    this.mapSearch = new MapSearch({map: this.map, isMobileApp: this.isMobileApp});

};

/**
 * Initialise user interface.
 */
UI.prototype.init = function(){
    $('.gpstrack-running').hide();
    $.mobile.loadingMessageTextVisible = true;

    if(this.cache === undefined){
        // desktop that doesn't support HTML5 canvas toDataURL
        // is a lost cause for caching
        $('#home-cache-map').attr('disabled', 'disabled');
        $('#home-saved-map').attr('disabled', 'disabled');
    }

    if(this.isMobileApp){
        document.addEventListener("backbutton", this.onBackKeyDown, false);

        // leave menu toggle out for timebeing
        document.addEventListener("menubutton", this.onMenuKeyDown, false);
        if(!Utils.isPrivilegedUser()){
            // disable settings for non privilged users, this will
            // no doubt change in later releases
            $('#home-page-dev').hide();
            console.debug("User does not have privileged access: " +
                          device.uuid);
        }
    }

    $('#map-login').click($.proxy(function(){
        if($('#map-login .ui-btn-text').text() == 'Login'){
            this.login();
        }
        else{
            $.mobile.changePage('profile.html');
        }
    }, this));

    // map zooming
    $(document).on('click',
                   '.map-zoom-button-in',
                   $.proxy(this.map.zoomIn, this.map));
    $(document).on('click',
                   '.map-zoom-button-out',
                   $.proxy(this.map.zoomOut, this.map));

    // home page show event
    $(document).on('pageshow', '#home-page', $.proxy(this.homePage, this));

    // map page init
    $(document).on('pageshow', '#map-page', $.proxy(this.mapPage, this));

    // capture landing page
    $(document).on('pageinit', '#capture-page', $.proxy(this.capturePage, this));

    // download landing page
    $(document).on(
        'pageinit',
        '#download-page',
        $.proxy(this.downloadPage, this)
    );

    // save map screen
    $(document).on('pageinit', '#save-map', $.proxy(function(){
        $('#cache-slider').bind(
            'change',
            $.proxy(this.cache.previewImagesChange, this.cache));
        $('#cache-save-slider .ui-slider-handle').bind(
            'vmousedown',
            $.proxy(this.cache.previewImagesMouseDown, this.cache));
        $('#cache-save-slider .ui-slider-handle').bind(
            'vmouseup',
            $.proxy(this.cache.previewImagesMouseUp, this.cache));
    }, this));
    $(document).on('pageshow', '#save-map', $.proxy(function(){
        this.cachePage();
    }, this));

    // save map name screen
    $(document).on(
        'pageinit',
        '#save-map-name-dialog',
        $.proxy(this.cachePageName, this)
    );

    // saved maps screen
    $(document).on('pageinit',
                   '#saved-maps-page',
                   $.proxy(this.cachedMapsPage, this));
    $(document).on('pageshow', '#saved-maps-page', $.proxy(function(){
        this.map.updateSize();
    }, this));

    // annotate page init
    $(document).on('pageinit',
                   '#annotate-page',
                   $.proxy(this.commonPageInit, this));
    $(document).on('pageshow',
                   '#annotate-page',
                   $.proxy(this.annotatePage, this));
    $(document).on('pageinit',
                   '#annotate-gps-page',
                   $.proxy(this.annotateGpsPage, this));
    $(document).on('pageshow',
                   '#annotate-preview-page',
                   $.proxy(this.annotatePreviewPage, this));

    $(document).on('pageshow',
                    '#test-page',
                    $.proxy( this.testPage, this));

    $(document).on('pageshow',
                    '#cache-tests-page',
                    $.proxy( this.testCachePage, this));

    // gpscapture page init
    $(document).on('pageshow',
                   '#gpscapture-page',
                   $.proxy(this.gpsCapturePage, this));

    // saved annotations page init
    $(document).on('pageinit',
                   '#saved-annotations-page',
                   $.proxy(this.savedAnnotationsPage, this));


    //help pages page inits
    var helpPageIds = [ '#contents-help-page',
                        '#getting-started-help-page',
                        '#offline-map-help-page',
                        '#custom-forms-help-page',
                        '#capture-data-help-page',
                        '#export-help-page'
                      ];

    for(var i=0; i< helpPageIds.length; i++){
        $(document).on('pageinit',
                    helpPageIds[i],
                    function (){
                        $("[data-role=header]").fixedtoolbar({tapToggle: false});
                        $("[data-role=footer]").fixedtoolbar({tapToggle: false});
        });
    };

    // settings page init
    $(document).on('pageinit', '#settings-page', $.proxy(this.settingsPage, this));
    $(document).on('pageremove', '#settings-page', $.proxy(function() {
        this.settings.save();
    }, this));

    // exit button
    $(document).on(
        'vmousedown',
        '#home-exit',
        $.proxy(this.exitApp, this)
    );

    $(document).on(
        'vmousedown',
        '.gpstrack-running',
        function(event){
            // timout hack prevents the clicking on the button on the
            // same position on the next page
            setTimeout(function(){
                $.mobile.changePage('gpscapture.html');
                event.stopPropagation();
            }, 400);

            return false;
        }
    );

    $(document).on(
        'vmousedown',
        '.user-locate',
        $.proxy(function(){
             this.geoLocate({
                secretly: false,
                updateAnnotateLayer: false,
                useDefault: false
            });

        }, this)
    );
    $(document).on(
        'pageinit',
        '#search-page',
        $.proxy(this.search, this)
    );

    $(document).on('pageinit',
        '#eula-page',
      $.proxy(this.eula, this)
    );

    $(document).on(
        'vclick',
        '#home-content-sync',
        $.proxy(function(event){
            event.preventDefault();
            this.sync({
                div: 'home-sync-popup',
                complete: function(){
                    $.mobile.changePage('capture.html')
                }
            });
        }, this)
    );

    $(document).on(
        'vclick',
        '#home-content-login',
        $.proxy(this.loginCloud, this)
    );

    $(document).on(
        'vclick',
        '#home-content-upload',
        $.proxy(this.uploadRecords, this)
    );

    // record initial screen height
    if(window.orientation === 0 || window.orientation === 180){
        this.portraitScreenHeight = $(window).height();
        this.landscapeScreenHeight = $(window).width();
    }
    else{
        this.portraitScreenHeight = $(window).width();
        this.landscapeScreenHeight = $(window).height();
    }

    // listen for windows resizes
    $(window).bind('resize', $.proxy(this.resizeWindow, this));

    // set up home map page
    this.homePage();
    this.map.switchBaseLayer();

    if(!Utils.isPrivilegedUser()){
        homepageDisplay.getNewsFeed('#updateFromServer');

        // show terms and conditions
        if(this.db.get('eula-accepted') === null){
            //get rid of the close button
            $.mobile.changePage('splash.html');

        } else {
            //show normal popup
            $('#splash-popup-dialog').popup({history: false});
            $('#splash-popup-dialog').popup('open');
        }
    }

    // locate user
    this.geoLocate({
        secretly: true,
        updateAnnotateLayer: false,
        useDefault: true
    });
};

/**
 * Go to annotate screen.
 */
UI.prototype.annotatePage = function(){
    var that = this;
    var type = this.db.get('annotate-form-type');
    var id;

    this.annotations.initPage(type, $.proxy(function(){
        // replace photo form element with image
        var showImage = function(id, url){
            var parent = $('#' + id).parent();
            $('#' + id).hide();
            parent.append('<div class="annotate-image"><img src="' +
                          url + '"</img></div>');
        };

        // replace audio form element with audio control
        var showAudio = $.proxy(function(id, url){
            var parent = $('#' + id).parent();
            $('#' + id).hide();
            parent.append(audioNode(url)).trigger('create');
        }, this);

        // listen for take photo click
        $('.annotate-image-take').click($.proxy(function(event){
            id = $(event.target).parents('.ui-grid-a').attr('id');
            this.annotations.takePhoto(function(media){
                showImage(id, media);
            });
        }, this));

        // listen for image gallery click
        $('.annotate-image-get').click($.proxy(function(event){
            id = $(event.target).parents('.ui-grid-a').attr('id');
            this.annotations.getPhoto(function(media){
                showImage(id, media);
            });
        }, this));



        // listen for audio click
        $('.annotate-audio').click($.proxy(function(event){
            id = $(event.target).parents('div').attr('id');
            this.annotations.takeAudio(function(media){
                showAudio(id, media);
            });
        }, this));

        // cancel button
        $('input[value="Cancel"]').click(function(){
            plugins.SoftKeyBoard.hide();
            //clear input fields
            that.currentAnnotation = undefined;
            window.history.back();
        });

        //image size
        $('input[name="radio-image-size"]').bind ("change", function (event){
            if(this.value === Annotations.IMAGE_SIZE_FULL){
               localStorage.setItem(Annotations.IMAGE_UPLOAD_SIZE, Annotations.IMAGE_SIZE_FULL);
               Utils.inform('Note : Larger images will take a longer time to sync', 5000);
            } else {
               localStorage.setItem(Annotations.IMAGE_UPLOAD_SIZE, Annotations.IMAGE_SIZE_NORMAL);

            }
         });


        // submit form
        $('#annotate-form').submit($.proxy(function(event){
            // cancels the form submission
            event.preventDefault();
            plugins.SoftKeyBoard.hide();
            // process the form
            this.currentAnnotation = this.annotations.processAnnotation(type);
        }, this));

        // if annotation in progress repopulate fields
        if(this.currentAnnotation !== undefined){
            $('#' + Annotations.TITLE_ID).val(this.currentAnnotation.record.name);
            $.each(this.currentAnnotation.record.fields, function(i, entry){
                var type = typeFromId(entry.id);
                if(type === 'text'){
                    $('#' + entry.id + ' input').val(entry.val);
                }
                else if(type === 'textarea'){
                    $('#' + entry.id + ' textarea').val(entry.val);
                }
                else if(type === 'image'){
                    showImage('annotate-image-0', entry.val);
                }
                else if(type === 'audio'){
                    showAudio('annotate-audio-0', entry.val);
                }
                else if(type === 'checkbox'){
                    $.each(entry.val.split(','), function(j, name){
                        $('input[value=' + name + ']').prop('checked', true).checkboxradio('refresh');
                    });
                }
                else if(type === 'radio'){
                    $('#' + entry.id + ' input[value=' + entry.val + ']').prop(
                        "checked", true).checkboxradio("refresh");
                }
                else if(type === 'range'){
                    $('#' + entry.id + ' input').val(entry.val);
                    $('#' + entry.id + ' input').slider('refresh');
                }
                else if(type === 'select'){
                    $('#' + entry.id + ' select').val(entry.val).attr(
                        "selected", true).selectmenu("refresh");
                }
                else{
                    console.warn("Unknown field type: " + type);
                }
            });
        }

        // ensure page is scrollable
        Utils.touchScroll('#annotate-form');
    }, this));
};

/**
 * GPS capture form page.
 */
UI.prototype.annotateGpsPage = function(){
    this.commonPageInit();

    var colour = "red";
    var defcolour = this.db.get('gps-track-color');
    if(defcolour){
        colour = defcolour;
    }
    else{
        this.db.set('gps-track-color', 'red');
    }

    // we need to add colour picker input dynamically otherwise
    // JQM will attempt to format the input element
    $('#annotate-gps-colour-pick').append('<input id="annotate-gps-colour-pick-input" type="color" name="color" />');

    Utils.appendDateTimeToInput("#annotate-gps-form-title");

    $("#annotate-gps-colour-pick-input").spectrum({
        showPalette: true,
        showPaletteOnly: true,
        color: colour,
        change: $.proxy(function(color) {
            this.db.set('gps-track-color', color.toString());
        }, this),
        palette: [
            ['red', 'orange', 'yellow', 'green'],
            ['blue', 'pink', 'white', 'black']
        ]
    });

    // listen on start button
    $('#annotate-gps-form-ok').click($.proxy(function(event){
        $('#annotate-gps-form').submit();
    }, this));

    // form submitted
    $('#annotate-gps-form').submit($.proxy(function(event){
        if($('#annotate-gps-form-title').val().length === 0){
            $('#annotate-gps-form-title').addClass('ui-focus');
            Utils.inform('Required field not populated');
        }
        else{
            this.currentGpsAnnotation = {
                'record':{
                    'editor': 'track.edtr',
                    'name': $('#annotate-gps-form-title').val(),
                    'fields': [
                        {
                            'id': 'fieldcontain-textarea-1',
                            'val': $('#annotate-gps-form-description').val(),
                            'label': 'Description',
                        },
                        {
                            // track currently must be second element,
                            // see Map.showGPSTrack
                            'id': 'fieldcontain-track-1',
                            'val': '',
                            'label': 'Track',
                            'style': {
                                strokeColor: this.db.get('gps-track-color'),
                                strokeWidth: 5,
                                strokeOpacity: 1
                            }
                        }
                    ],
                },
                'isSynced': false,
                'rate': $('#annotate-gps-form-rate').val()
            };
            plugins.SoftKeyBoard.hide();
            $.mobile.changePage('gpscapture.html');
        }

        return false;
    }, this));

};

/**
 * Annotate option, show drag icon.
 */
UI.prototype.annotatePreviewPage = function(){
    this.commonMapPageInit('annotate-preview-map');

    if(this.db.get('ignore-centre-on-annotation') === 'true'){
        this.map.updateAnnotateLayer();
        this.db.set('ignore-centre-on-annotation', false);
    }
    else {
        this.geoLocate({
            secretly: false,
            updateAnnotateLayer: true,
            useDefault: true
        });
    }

    var addMeta = function(label, text){
        $('#annotate-preview-detail-meta').append(
            '<p><span>' + label + '</span>: ' + text + '</p>');
    }

    $('.non-map-body-white h2').text(this.currentAnnotation.record.name + ' Details');

    $.each(this.currentAnnotation.record.fields, $.proxy(function(i, entry){
        if(typeFromId(entry.id) === 'image'){
            $('#annotate-preview-detail-image').append(
                '<img src="' + entry.val + '"></img>');
        }
        else{
            addMeta(entry.label, entry.val);
        }
    }, this));

    $('#annotate-preview-ok').click($.proxy(function(){
        this.annotations.saveAnnotationWithCoords(this.currentAnnotation);
        this.currentAnnotation = undefined;
        $.mobile.changePage('map.html');
    }, this));

    Utils.touchScroll('#annotate-preview-detail');

    this.map.hideAnnotationsLayer();
    this.map.updateSize();
};

/**
 * View map caching page.
 */
UI.prototype.cachePage = function(){
    this.commonMapPageInit('save-map-map');
    var layer = this.map.getSavedMapsLayer();

    layer.removeAllFeatures();

    $('#cache-controls').hide();
    $('#cache-preview').hide();
    $('#save-map-buttons').show();

    this.map.getAnnotateLayer().setVisibility(false);
    this.map.getAnnotationsLayer().setVisibility(false);

    var connection = Utils.getConnectionStatus();
    if(this.isMobileApp &&
       (connection.val === Connection.UNKNOWN ||
        connection.val === Connection.CELL_2G ||
        connection.val === Connection.NONE)){
        console.debug('current connection: ' + connection.str);
        Utils.inform("You will need a decent network connection to use this functionality.");
    }

    $('#save-map-buttons-ok').click(function(){
        $('#cache-controls').show();
        $('#save-map-buttons').hide();
    });

    // initialise slider values according to zoom level
    this.setSliderValues();

    this.map.registerZoom(this, function(){
        this.setSliderValues();
    });

    $('#cache-save-details-zoom-level-but').val('1');


    if(this.cache.getSavedMapsCount() < Cache.MAX_NO_OF_SAVED_MAPS){
        $('#save-map-buttons-ok').removeClass('ui-disabled');
    }
    else{
        $('#save-map-buttons-ok').addClass('ui-disabled');

        setTimeout(function(){
            Utils.inform('You have reached the maximum number of saved maps.');
        }, 1000);
    }

    this.map.updateSize();
};

/**
 * Save Map Name dialog.
 */
UI.prototype.cachePageName = function(){
    var dlSize = this.cache.totalNumberOfTilesToDownload(
        this.map.getZoomLevels().current,
        $('#saved-map-name-dialog-save-to').val()) * Cache.AV_TILE_SIZE;

    this.saveMap = false;

    $('#save-map-name-dialog-info').html(
        '<p>' + $('#cache-save-details-text-stats').text() + '</p>');

    $('#saved-map-name-dialog-text').val(new Date().toLocaleString().substr(0, 24));
    $('#saved-map-name-dialog-save-to').val($("#cache-slider").val());
    $('#saved-map-name-dialog-btn').click($.proxy(function(){
        $('.ui-dialog').dialog('close');
        this.saveMap = true;
    }, this));

    // use pageremove on save map name screen otherwise attaching the
    // showPageLoadingMsg to the page is problematic
    $('#save-map-name-dialog').on(
        'pageremove',
        $.proxy(function(){
            if(this.saveMap){
                if(this.cache.saveMap($('#saved-map-name-dialog-text').val(),
                                      this.map.getZoomLevels().current,
                                      $('#saved-map-name-dialog-save-to').val())){
                }
            }
        }, this)
    );
};

/**
 * Show saved maps screen.
 */
UI.prototype.cachedMapsPage = function(){
    this.commonMapPageInit('saved-maps-map');
    var maps = this.cache.getSavedMaps();
    var count = 0;
    if(maps){
        // build saved maps list
        $.each(maps, function(index, value){
            $('#saved-maps-list-list').append(
              '<li><fieldset class="ui-grid-b"> \
                 <div class="ui-block-a">\
                   <a href="#" class="saved-map-click">\
                     <h3>' + index + '</h3></a>\
                 </div>\
                 <div class="ui-block-b">\
                 </div>\
                 <div class="ui-block-c">\
                 </div>\
               </fieldset>\
             </li>').trigger('create');
            ++count;
        });
    }

    if(count === 0){
        $('#saved-maps-list').html('<p class="large-text">No saved maps - go to <a href="save-map.html">Download</a> to create saved maps</p>');
    }
    else if(count < Cache.MAX_NO_OF_SAVED_MAPS){
        $('#saved-maps-list').append('<p class="large-text"><a href="save-map.html">Download more maps</a></p>');
    }

    // display a saved map on main map
    var displayOnMap = $.proxy(function(){
        var name = this.selectedSavedMap.find('h3').text();
        var details = this.cache.getSavedMapDetails(name);

        if(details){
            this.map.showSavedMaps(details);
        }
    }, this);

    // context menu popup
    $('#saved-maps-list-popup').bind({
        // populate popup with map name
        popupafteropen: $.proxy(function(event, ui) {
            this.selectedSavedMap.toBeDeleted = false;
            $('#saved-maps-list-popup [data-role="divider"]').text(
                this.selectedSavedMap.find('h3').text());
        }, this),
        popupafterclose: $.proxy(function() {
            if(this.selectedSavedMap.toBeDeleted){
                // this hack is in the documentation for chaining popups:
                // http://jquerymobile.com/demos/1.2.0/docs/pages/popup/index.html
                setTimeout( function(){
                    $('#saved-maps-delete-popup').popup('open');
                }, 100);
            }
        }, this)
    });
    $('#saved-maps-list-popup-view').click($.proxy(function(event){
        // view selected
        $.mobile.changePage('map.html');
        displayOnMap();
    }, this));
    $('#saved-maps-list-popup-delete').click($.proxy(function(event){
        // delete selected
        this.selectedSavedMap.toBeDeleted = true;
        $('#saved-maps-list-popup').popup('close');
    }, this));
    $('#saved-maps-delete-popup').bind({
        // populate delete dialog with map name
        popupafteropen: $.proxy(function(event, ui) {
            $('#saved-maps-delete-popup-name').text(
                this.selectedSavedMap.find('h3').text());
        }, this)
    });
    $('#saved-maps-delete-popup-confirm').click($.proxy(function(event){
        // confirm map delete
        this.cache.deleteSavedMapDetails(this.selectedSavedMap.find('h3').text());
        $('#saved-maps-delete-popup').popup("close");
        $(this.selectedSavedMap).slideUp('slow');
    }, this));

    // click on a saved map
    $('.saved-map-click').on(
        'tap',
        $.proxy(function(event){
            if(!this.taphold){
                this.selectedSavedMap = $(event.target).parents('li');
                displayOnMap();
            }
            else{
                // taphold has been lifted
                this.taphold = false;

                // prevent popup dialog closing
                event.preventDefault();
            }
        }, this));

    // press and hold on a saved map
    $('.saved-map-click').on(
        'taphold',
        $.proxy(function(event){
            this.selectedSavedMap = $(event.target).parents('li');
            $('#saved-maps-list-popup').popup('open', {positionTo: 'origin'});
            this.taphold = true;
        }, this));

    // make map list scrollable on touch screens
    Utils.touchScroll('#saved-maps-list');

    $('#saved-maps-list-list').listview('refresh');

    // show first map on list
    this.selectedSavedMap = $('#saved-maps-list li:first');
    displayOnMap();
};

/**
 * Set up capture page.
 */
UI.prototype.capturePage = function(){
    var blocks = ['a', 'b', 'c', 'd', 'e'];
    this.annotations.getEditors($.proxy(function(editors){
        $.each(editors, function(i, editor){
            var name = editor.name.substr(0, editor.name.indexOf('.'))
            var html = '<div class="ui-block-' + blocks[i % 5] + '"><a id="annotate-custom-form-' + name + '" class="annotate-custom-form" href="#"><img src="css/images/custom.png"></a><p>' + name + '</p></div>';
            $('#capture-page-custom').append(html);
        });

        this.commonPageInit();
        this.capturePageListeners();
    }, this));

    // enable / disable GPS track button
    this.gpsButtonInit();
};

/**
 * Bind annotation form listeners.
 */
UI.prototype.capturePageListeners = function(){

    // note: obscure bug with dynamic loading of editors where the last form
    // control was grabbing focus.  This was 'fixed' by specifying a 'fade'
    // transition. see: http://devel.edina.ac.uk:7775/issues/4919

    // unbind is required as this is used in the home page
    $('.annotate-image-form').unbind();
    $('.annotate-image-form').on('vmousedown', $.proxy(function(){
        this.db.set('annotate-form-type', 'image');
        $.mobile.changePage('annotate.html', {transition: "fade"});
    }, this));

    $('.annotate-audio-form').unbind();
    $('.annotate-audio-form').on('vmousedown', $.proxy(function(){
        this.db.set('annotate-form-type', 'audio');
        $.mobile.changePage('annotate.html',  {transition: "fade"});
    }, this));

    $('.annotate-text-form').unbind();
    $('.annotate-text-form').on('vmousedown', $.proxy(function(){
        this.db.set('annotate-form-type', 'text');
        $.mobile.changePage('annotate.html',  {transition: "fade"});
    }, this));

    $('.annotate-custom-form').unbind();
    $('.annotate-custom-form').on('vmousedown', $.proxy(function(event){
        // get the custom form type from the element id
        var id = $(event.target).parent().attr('id');
        this.db.set('annotate-form-type', id.substr(id.lastIndexOf('-') + 1));
        $.mobile.changePage('annotate.html', {transition: "fade"});
    }, this));
};

/**
 * Delete cached maps.
 * @param callback Function that is invoked when ok is pressed.
 */
UI.prototype.clearMapCache = function(callback){
    Utils.confirm('Clear Cache',
            'Are you sure you wish to permanently delete your saved maps?',
            this,
            function(){
                this.cache.clearCache(function(){
                    $.mobile.changePage('index.html');
                });
            });
};

/**
 * Perform operations that should be performed on all map pages after
 * initialisation.
 * @param mapDiv The div the map should be rendered on.
 */
UI.prototype.commonMapPageInit = function(mapDiv){
    this.commonPageInit();
    console.debug("render map");
    this.map.render(mapDiv);

    // hack to fix bug, with older android devices, introduced with jq mobile
    // 1.1.0 where zoom buttons were not positioned correctly after navigating
    // from a minor page back to index.html
    this.map.getBaseLayer().redraw();
};

/**
 * Perform operations that should be performed on all pages after initialisation.
 */
UI.prototype.commonPageInit = function(){
    this.initialScreenSize = $(window).height();

    $("[data-role=header]").fixedtoolbar({tapToggle: false});
    $("[data-role=footer]").fixedtoolbar({tapToggle: false});

    if(this.annotations.gpsTrackStarted()){
        $('.gpstrack-running').show();
    }
    else{
        $('.gpstrack-running').hide();
    }

    // work out page height
    this.resizePage();
};

/**
 * Initialise download page.
 */
UI.prototype.downloadPage = function(){
    this.commonPageInit();

    this.annotations.cloudCheckUser($.proxy(function(state){
        if(state === 1){
            $('#download-upload-records').show();
            $('#download-upload-records').on(
                'vmousedown',
                $.proxy(this.uploadRecords, this)
            );

            $('#download-editors').show();
            $('#download-editors').on(
                'vmousedown',
                $.proxy(function(){
                    Utils.showPageLoadingMsg('Download Editors ...');
                    this.annotations.syncDownloadAllEditors(function(){
                        $.mobile.hidePageLoadingMsg();
                        $.mobile.changePage('capture.html');
                    });
                }, this)
            );
        }
        else{
            $('#download-editors').hide();
            $('#download-upload-records').hide();
        }
    }, this));

};

/**
 * Initialise GPS capture page.
 */
UI.prototype.gpsCapturePage = function(){
    this.commonMapPageInit('gpscapture-map');

    var changeToResume = function(){
        $("#gpscapture-pause-play .ui-btn-text").text('Resume');
        $("#gpscapture-pause-play .ui-icon").css('background-image',
                                                 'url("css/images/play.png")');
    }

    if(this.annotations.gpsTrackPaused()){
        changeToResume();
    }

    // save GPS route
    $('#gpscapture-confirm-save').click($.proxy(function(e){
        this.annotations.gpsCaptureComplete();
        $.mobile.changePage('map.html');
    }, this));

    // cancel GPS route save
    $('#gpscapture-confirm-cancel').click($.proxy(function(){
        this.annotations.gpsTrack();
    }, this));

    // pause/resume GPS track button
    $('#gpscapture-pause-play').click($.proxy(function(){
        if($("#gpscapture-pause-play").text().trim() === 'Pause'){
            this.annotations.gpsTrackPause();
            changeToResume();
        }
        else{
            this.annotations.gpsTrackPlay(
                this.currentGpsAnnotation.rate,
                this.settings.debugGPS());
            $("#gpscapture-pause-play .ui-btn-text").text('Pause');
            $("#gpscapture-pause-play .ui-icon").css('background-image',
                                                 'url("css/images/pause.png")');
        }

        $('#gpscapture-pause-play').removeClass('ui-btn-active');
    }, this));

    // toogle track visibility
    $('#gpscapture-toggle-route').click($.proxy(function(){
        this.map.gpsTrackToggle();
        $('#gpscapture-toggle-route').removeClass('ui-btn-active');
    }, this));

    // discard track
    $('#gpscapture-confirm-discard').click($.proxy(function(){

        this.annotations.gpsCaptureDiscard();

        $('#gpscapture-toggle-route').removeClass('ui-btn-active');
        $.mobile.changePage('map.html');
    }, this));

    // kick off capture
    this.annotations.gpsTrack(this.currentGpsAnnotation, this.settings.debugGPS());

    this.map.hideAnnotateLayer();

    this.map.updateSize();
};

/**
 * Exit App.
 */
UI.prototype.exitApp = function(){
    $('#home-exit-popup').popup('open');

    $('#home-exit-confirm').off('vmousedown');
    $('#home-exit-confirm').on(
        'vmousedown',
        $.proxy(function(){
            // ensure any running track is completed
            this.annotations.gpsCaptureComplete();

            navigator.app.exitApp();
        }, this)
    );
};

/**
 * Set map to user's location.
 * @param secrectly If true do not show page loading msg.
 * @param updateAnnotateLayer Should annotate layer be updated after geolocate?
 * @param if no user location found should default be used?
 */
UI.prototype.geoLocate = function(options){
    if(typeof(options.secretly) === 'undefined'){
        options.secretly = false;
    }

    this.map.geoLocate({
        interval: this.settings.getLocateInterval(),
        secretly: options.secretly,
        updateAnnotateLayer: options.updateAnnotateLayer,
        useDefault: options.useDefault
    });
};

/**
 * Disable GPS button if GPS track is ongoing.
 */
UI.prototype.gpsButtonInit = function(){
    if(this.annotations.gpsTrackStarted()){
        $('.gps-track-start').parent().css('opacity', '0.2');
        $('.gps-track-start').removeAttr('href');
    }
    else{
        $('.gps-track-start').parent().css('opacity', '1');
        $('.gps-track-start').attr('href', 'annotate-gps.html');
    }
};

/**
 * Set up home page.
 * @param event The click event.
 */
UI.prototype.homePage = function(event){
    if(event){
        event.stopImmediatePropagation();
    }

    this.commonPageInit();

    deviceDependent.setUpExitButton();

    Utils.touchScroll('#home-content');
    Utils.absoluteHeightScroller('#splash-popup-dialog-content');
    Utils.touchScroll('#splash-popup-dialog-content');

    $(document).on('click', '#splash-popup-dialog a', function() {
        $('#splash-popup-dialog').popup('close');
    });

    // the home page stays in memory so ui-btn-active must be added dynamically
    $('.menu a:first').addClass('ui-btn-active');

    // check stored user id
    this.annotations.cloudCheckUser($.proxy(function(state){
        if(state === 1){
            homepageDisplay.showLogoutAndSync();
        }
        else{
            this.logoutCloud();
        }
    }, this));

    // enable / disable GPS track button
    this.gpsButtonInit();

    this.capturePageListeners();

    $('#home-content-help').unbind();
    $('#home-content-help').on('taphold', function(){
        $('#home-page-dev').show();
    });
};

/**
 * Is the user currently logged in?
 * @return True if the user is looged in.
 */
UI.prototype.isUserLoggedIn = function(){
    return this.db.get('profile') !== null;
};

/**
 * Log the user into digimap.
 */
UI.prototype.login = function(){
    function locationChanged(newurl, arg){
        if(newurl.substring(0, 41) === 'http://digimap.edina.ac.uk/main/index.jsp'){
            // when digimap login page is recognised close child browser
            window.plugins.childBrowser.close();
        }
    }

    function closed(digimapId) {
        console.debug("The JS got a close event: " + digimapId);
        if(digimapId !== undefined){
            var now = new Date();
            var expires = new Date(now.getTime() + 604800000);
            var profile = {
                digimapId: digimapId,
                expiryDate: expires,
            }

            this.db.set('profile', JSON.stringify(profile));

            // change button text
            $('#map-login .ui-btn-text').text('Profile');

            // switch to digimap stack
            $.mobile.changePage('index.html');
            this.map.switchToClosed();
        }
    }

    var url = 'http://geomobilesrv.edina.ac.uk/login.html';
    //var url = 'http://devel.edina.ac.uk:3333/login.html';
    var lonlat = this.map.getLocateCoords();
    var url = url + '?lon=' + lonlat.lon + "&lat=" + lonlat.lat;

    window.plugins.childBrowser.onLocationChange = locationChanged;
    window.plugins.childBrowser.onClose = $.proxy(closed, this);
    window.plugins.childBrowser.showWebPage(url,
                                            { showLocationBar: false});
};

/**
 * Login open user - currently not used.
 */
UI.prototype.loginOpen = function(){
    var url;
    if(this.isMobileApp){
        url = $('#login-form').attr('action');
    }
    else{
        url = '/openstream/registration/dologin';
    }

    var request = $.ajax({
        type: 'POST',
        url: url,
        cache: false,
        data: $('#login-form').serialize(),
        success: $.proxy(function(response, status, request) {
            var apikey = $(response).find('.apikey');
            if(apikey.length === 0){
                // no api key in returned data
                var error = $(response).find('.error');
                var msg;

                if(error.length > 0){
                    msg = $(error[0]).text();
                }
                else{
                    msg = 'Problem logging in.';
                }

                $('#login-message').html('<p class="error">' + msg + '</p>');
            }
            else{
                var profile = $(response).find('.profile');
                var details = $(profile[0]).text();

                // this mince should be fixed when openstream login pages
                // become more structured
                var apiKey = $.trim($(apikey[0]).text().replace(/\r\n|\r|\n/, ""));
                var detailsArray = details.split(/\r\n|\r|\n/);
                var name = detailsArray[1].replace(/First name: /, '') + ', ' + detailsArray[2].replace(/Last name: /, '');
                var email = detailsArray[3].replace(/Email: /, '');
                var regDate = detailsArray[4].replace(/Registration Date: /, '');

                var now = new Date();
                var expires = new Date(now.getTime() + 604800000);
                var profile = {
                    apiKey: apiKey,
                    name: name,
                    email: email,
                    expiryDate: expires,
                    regDate: regDate
                }

                this.db.set('profile', JSON.stringify(profile));

                $('#map-login .ui-btn-text').text('Profile');
                $.mobile.changePage('index.html');
            }
        }, this)
    });

    return false;
};

/**
 * Sync device with cloud.
 * @param div - The div to append confirmation popup.
 * @param callback - A function that will be executed for each annotation created
 * or deleted as part of the sync.
 * @param complete - A function that will be executed when sync is complete.
 */
UI.prototype.sync = function(options){
    // to avoid duplication add pop up dynamically
    $('#' + options.div).empty();
    $('#' + options.div).append(
      '<div data-theme="d" class="ui-corner-all ui-content">\
         <p>All records and forms will be downloaded and all local records will be uploaded (since last sync). To upload records only, use upload button.\
         </p>\
         <a href="#"\
            data-theme="a"\
            data-role="button"\
            data-inline="true"\
            data-rel="back">Cancel</a>\
         <a class="sync-confirm"\
            data-theme="a"\
            href="#"\
            data-role="button"\
            data-inline="true">Continue</a>\
       </div>').trigger('create');

    $(document).off('vmousedown', '.sync-confirm');
    $(document).on(
        'vmousedown',
        '.sync-confirm',
        $.proxy(function(event){
            event.preventDefault();
            $('#' + options.div).popup('close');
            this.annotations.sync({
                callback: options.callback,
                complete: options.complete
            });
        }, this)
    );

    // timeout allows popup to stay visible on the saved records page on all
    // devices see https://redmine.edina.ac.uk/issues/8228
    setTimeout(function(){
        $('#' + options.div).popup('open');
    }, 750);
};

/**
 * Only load Qunit once and only if needed.
 * @param cb Function Executed after qunit loaded.
 */
UI.prototype.loadQunit = function(cb, qunitJsUrl, qunitCssUrl){
    var hrefCss = (qunitCssUrl ||  "css/ext/qunit.css");
    var hrefJs = (qunitJsUrl || 'js/ext/qunit.js');
    if(typeof(QUnit) === 'undefined'){
        $("<link/>", {
            rel: "stylesheet",
            type: "text/css",
            href: hrefCss
        }).appendTo("head");

        $.getScript(hrefJs, function(){
            QUnit.load();
            cb();
        });
    }
    else{
        cb();
    }
};

/**
 * Login
 */
UI.prototype.loginCloud = function(){
    // use icon to determine whether to login or logout
    var icon = $('#home-content-login img').attr('src');
    icon = icon.substr(icon.lastIndexOf('/') + 1);

    if(icon === 'login-large.png'){
        this.annotations.cloudLogin($.proxy(function(){
            $.mobile.hidePageLoadingMsg();
            var userId = this.db.getCloudLogin().id;
            if(userId){
                homepageDisplay.showLogoutAndSync();
            }
        }, this));
    }
    else {
        this.logoutCloud();
    }
};

/**
 * logout user
 */
UI.prototype.logoutCloud = function(){
    this.annotations.clearCloudLogin();
    homepageDisplay.hideSyncAndShowLogin();
};

/**
 * Initialise map page.
 */
UI.prototype.mapPage = function(){
    // set up buttons when records a visible on map
    var recordsVisible = function(){
        $('#map-annotations-buttons-ok .ui-btn-text').text('Hide Records');
        $('#map-annotations-buttons-list a').show();
    }

    // set up buttons when records are hidden
    var recordsHidden = function(){
        $('#map-annotations-buttons-ok .ui-btn-text').text('Show Records');
        $('#map-annotations-buttons-list a').hide();
    }

    $('#map-annotations-buttons-ok').click($.proxy(function(event){
        var label = $('#map-annotations-buttons-ok .ui-btn-text').text();
        if(label === 'Show Records'){
            this.map.showAnnotationsLayer();
            recordsVisible();
        }
        else{
            this.map.hideAnnotationsLayer();
            recordsHidden();
        }
    }, this));

    if(this.map.getAnnotationsLayer().visibility){
        recordsVisible();
    }
    else{
        recordsHidden();
    }

    this.map.showAnnotateLayer();
    this.commonMapPageInit('map');
    this.map.updateSize();
};

/**
 * press to back button
 */
UI.prototype.onBackKeyDown = function() {
    window.history.back();
};

/**
 * handle the menu button
 */
UI.prototype.onMenuKeyDown = function(){
    //$.mobile.fixedToolbars.toggle();
};

/**
 * view profile details
 */
UI.prototype.profile = function(){
    var profile;
    try{
        var profile = JSON.parse(this.db.get('profile'));

        $('#profile-digimap-id').text(profile.digimapId);
        $('#profile-uuid').text(device.uuid);
        $('#profile-expiry').text(profile.expiryDate.toLocaleString());

        $('#profile-logout').unbind('click');
        $('#profile-logout').click($.proxy(this.logout, this));
    }
    catch(SyntaxError){
        // problem with profile, just remove it
        this.db.remove('profile')
        $('#map-login .ui-btn-text').text('Login');
        $.mobile.changePage('index.html');
    }
};

/**
 * Calculate page content height.
 */
UI.prototype.resizePage = function(){
    // work out page height
    var offset = 4;

    var h = $(window).height() - ($('.ui-page-active .ui-header').first().height() + $('.ui-page-active .ui-footer').first().height() + offset);
    $('[data-role=content]').css('height', h + 'px');
};

/**
 * Window has been resized, with by orientation change of by the appearance of
 * the keyboard. A bug in JQM with some versions of android leaves the footer
 * remains visible when the keyboard is visible. This function hides the footer.
 */
UI.prototype.resizeWindow = function(){
    // recording landscape height from potrait and vis-versa is not exact,
    // so add a little tolerance
    var tolerance = 30;
    var keyboardVisible;

    if((window.orientation === 0 || window.orientation === 180) &&
       ((window.innerHeight + tolerance) < this.portraitScreenHeight)){
        console.debug("keyboard visible: " + window.innerHeight + " : " +
                      this.portraitScreenHeight);
        keyboardVisible = true;
    }
    else if((window.innerHeight + tolerance) < this.landscapeScreenHeight){
        console.debug("keyboard visible: " + window.innerHeight + " : " +
                      this.landscapeScreenHeight);
        keyboardVisible = true;
    }

    if(keyboardVisible){
        $("[data-role=footer]").hide();
    }
    else{
        $("[data-role=footer]").show();
        this.resizePage();
    }
};

/**
 * Popup EULA dialogue.
 */
UI.prototype.eula = function(){
    //bind click

    $('#accept-eula').click($.proxy (function(){
        this.db.set('eula-accepted', 'YES');
    }, this));

    $('#show-eula').click(function(){
        window.open("http://fieldtripgb.blogs.edina.ac.uk/end-user-licence-agreement/",
                    '_blank',
                    'location=yes');
    });
};

/**
 * kick off map search
 */
UI.prototype.search = function(){
    var inFocus = 0;

    $('#search-page').on('pagebeforehide', function (event, ui){
        plugins.SoftKeyBoard.hide();
    });

    $('#search-spinner').hide();
    $('#searchterm').keyup($.proxy(function(event){
        if ((event.keyCode === 38) || (event.keyCode === 40)){
            // up or down arrow has been clicked focus on entry
            $($('#search-results li')).blur();
            if(event.keyCode === 38){
                if(inFocus >= 0){
                    --inFocus;
                }
            }
            else{
                if(inFocus < $('#search-results li').length){
                    ++inFocus;
                }
            }

            $($('#search-results li')[inFocus]).focus();
        }
        else if(event.keyCode === 13){
            // enter pressed
            var entry = $('#search-results li')[inFocus];
            if(entry){
                this.mapSearch.centreOnPlace($(entry));
            }
        }
        else{
            // ignore non character keys (except delete) and anything less than 3 characters
            if((String.fromCharCode(event.keyCode).match(/\w/) || event.keyCode === 8) &&
               $('#searchterm').val().length > 2){
                inFocus = -1;
                this.mapSearch.autocomplete();
            }
        }
    }, this));
};

/**
 * Initialise settings page.
 */
UI.prototype.settingsPage = function(){
    this.commonPageInit();
    this.settings.restore();

    $('#settings-ftgb').text(Utils.version);
    $('#settings-jquery').text($().jquery);
    $('#settings-jqm').text(jQuery.mobile.version);
    $('#settings-ol').text(OpenLayers.VERSION_NUMBER);

    if(this.isMobileApp){
        $('#settings-cordova').text(device.cordova);
    }

    $('#settings-mapserver-url').bind("change", $.proxy(function(){
        this.logoutCloud();
        this.map.switchBaseLayer($('#settings-mapserver-url option:selected').val());
    }, this));
    $('#settings-clear-local-storage').click($.proxy(function(){
        this.db.clear();
        Utils.inform('done')
    }, this));
};

/**
 * Set the page title
 * @param title The new page title
 */
UI.prototype.setTitle = function(title){
    $('#map-header h1').text(title);
};

/**
 * Set cache slider values depending on map resolution.
 */
UI.prototype.setSliderValues = function(){
    var zooms = this.map.getZoomLevels();

    if(zooms.current === zooms.max){
        $('#cache-slider').slider("disable");
    }
    else{
        $('#cache-slider').slider("enable");
    }

    $('#cache-slider').attr('min', zooms.current);
    $('#cache-slider').attr('max', zooms.max);
    $("#cache-save-slider input").val(zooms.current).slider("refresh");

    this.cache.setSaveStats(zooms.current, zooms.current);
};

/**
 * Set up automated testing page.
 */
UI.prototype.testPage = function () {

    this.loadQunit($.proxy(function(){
        if(typeof(testing) === 'undefined'){
            $.ajax({
                url: 'js/tests/tests.js',
                cache: false,
                dataType: 'script',
                success: $.proxy(function(){
                    initTests({
                        map: this.map,
                        annotations: this.annotations,
                        cache: this.cache,
                        settings: this.settings
                    });
                }, this),
                error: function(error){
                    console.error(error);
                }
            });
        }
    }, this));
};

/**
 * Set up testing page.
 */
UI.prototype.testCachePage = function () {
    var that = this;
    var hrefCss = '../css/ext/qunit.css';
    var hrefJs = '../js/ext/qunit.js';
    this.loadQunit(function(){


        if(cacheTests === undefined){
            $.getScript('../js/tests/cache-tests.js', function(data, textStatus, xhr){
                cacheTests.runTests(that);
            });
        } else {

            cacheTests.runTests(that);

        }

        if(moreTests === undefined){
            $.getScript('../js/tests/more-tests.js', function(){
                moreTests.runTests(that);
            });
        } else {

            moreTests.runTests(that);

        }
    },
    hrefJs,
    hrefCss
    );
};

/**
 * Show Saved Records.
 */
UI.prototype.savedAnnotationsPage = function(){
    this.commonPageInit();
    var annotations = this.annotations.getSavedAnnotations();

    //Utils.printObj(annotations);

    var addAnnotation = function(id, annotation){
        $('#saved-annotations-list-list').append(
            '<li id="' + id + '"><div class="ui-grid-b"> \
               <div class="ui-block-a saved-annotations-list-synced-' + annotation.isSynced + '">\
               </div>\
               <div class="ui-block-b saved-annotation-view">\
                 <a href="#">' + annotation.record.name + '</a>\
               </div>\
               <div class="ui-block-c">\
                 <a href="#" class="saved-annotation-delete" data-role="button" data-icon="delete" data-iconpos="notext" data-theme="a"></a>\
               </div>\
             </div></li>').trigger('create');
    }

    $.each(annotations, $.proxy(function(id, annotation){
        if(annotation){
            addAnnotation(id, annotation);
        }
        else{
            // empty entry, just delete it
            delete annotations[id];
            this.annotations.setSavedAnnotations(annotations);
        }
    }, this));

    // delete a saved annotation
    $(document).off('vmousedown', '.saved-annotation-view');
    $(document).on(
        'vmousedown',
        '.saved-annotation-delete',
        $.proxy(function(event){
            this.toBeDeleted = $(event.target).parents('li');

            // open dialog for confirmation
            $('#saved-annotation-delete-popup-name').text(
                "'" + this.toBeDeleted.find('.saved-annotation-view a').text() + "'");
            $('#saved-annotation-delete-popup').popup('open');
        }, this)
    );

    // delete confirm
    $('#saved-annotation-delete-confirm').click($.proxy(function(event){
        var id = $(this.toBeDeleted).attr('id');
        this.annotations.deleteAnnotation(id, true);
        $('#saved-annotation-delete-popup').popup('close');
        this.toBeDeleted.slideUp('slow');
    }, this));

    // click on a record
    $(document).off('tap', '.saved-annotation-view');
    $(document).on(
        'tap',
        '.saved-annotation-view',
        $.proxy(function(event){
            if(this.isMobileApp){
                // this will prevent the event propagating to next screen
                event.stopImmediatePropagation();
            }

            var id = $(event.target).parents('li').attr('id');
            var annotation = this.annotations.getSavedAnnotations()[id];
            var type = getEditorId(annotation);

            if(type === 'track'){
                this.map.showGPSTrack(id, annotation);
            }

            this.map.showAnnotationsLayer(annotation);
            $.mobile.changePage('map.html');
        }, this)
    );

    // sync / login button
    $(document).off('vmousedown', '#saved-annotations-page-header-login-sync');
    $(document).on(
        'vmousedown',
        '#saved-annotations-page-header-login-sync',
        $.proxy(function(event){
            event.stopImmediatePropagation();
            if($('#saved-annotations-page-header-login-sync.cloud-sync').length > 0){
                this.sync({
                    div: 'saved-annotation-sync-popup',
                    callback: function(add, id, annotation){
                        if(add){
                            addAnnotation(id, annotation);
                        }
                        else{
                            // if not add then delete
                            $('#' + id).slideUp('slow');
                        }
                    },
                    complete: function(){
                        $('#saved-annotations-list-list').listview('refresh');
                    }
                });
            }
            else{
                $.mobile.showPageLoadingMsg();
                this.annotations.cloudLogin($.proxy(function(){
                    $.mobile.hidePageLoadingMsg();
                    var userId = this.db.getCloudLogin().id;
                    if(userId){
                        $('#saved-annotations-page-header-login-sync').removeClass(
                            'cloud-login');
                        $('#saved-annotations-page-header-login-sync').addClass(
                            'cloud-sync');
                        $('#saved-annotations-page-header-upload').show();
                    }
                }, this));
            }
        }, this)
    );

    // upload only
    $(document).off('vmousedown', '#saved-annotations-page-header-upload');
    $(document).on(
        'vmousedown',
        '#saved-annotations-page-header-upload',
        $.proxy(this.uploadRecords, this)
    );

    var userId = this.db.getCloudLogin().id;
    if(userId){
        $('#saved-annotations-page-header-login-sync').addClass('cloud-sync');
        $('#saved-annotations-page-header-upload').show();
    }
    else{
        $('#saved-annotations-page-header-login-sync').addClass('cloud-login');
    }

    // make records scrollable on touch screens
    //Utils.touchScroll('#saved-annotations-list');

    $('#saved-annotations-list-list').listview('refresh');
};

/**
 * draw Line switch has been clicked.
 */
UI.prototype.toggleDrawLine = function(){
    if($('#map-buttons-draw-slider option:selected').val() === 'on'){
        $('#map-buttons-complete-button').show();
        $('#map-buttons-clear-button').show();
    }
    else{
        $('#map-buttons-complete-button').hide();
        $('#map-buttons-clear-button').hide();
    }
};

/**
 * Open / close help option.
 */
UI.prototype.toggleHelp = function(){
    $('#map-help-open').toggle();
    $('#map-help-closed').toggle();
};

/**
 * Upload all locally stored records.
 */
UI.prototype.uploadRecords = function(event){
    event.preventDefault();
    Utils.showPageLoadingMsg('Upload Records');
    this.annotations.syncUploadRecords(function(){
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage("saved-annotations.html");
    });
};

/**
 * Currently a wrapper for HTML5 localstorage.
 */
var Storage = function() {
    this.store = window.localStorage;
};

/**
 * Delete all storage entries.
 */
Storage.prototype.clear = function() {
    this.store.clear();
};

/**
 * Set cloud login details to undefined.
 */
Storage.prototype.clearCloudLogin = function() {
    this.set('cloud-user', JSON.stringify({'id': undefined}));
};

/**
 * @return Number of storage entries.
 */
Storage.prototype.count = function(resultHandler) {
    return this.store.length;
};

/**
 * @param key
 * @return Value for given key.
 */
Storage.prototype.get = function(key){
    return this.store.getItem(key);
};

/**
 * @param index
 * @return Key at index position.
 */
Storage.prototype.key = function(index){
    return this.store.key(index);
};

/**
 * @return Array of keys in store.
 */
Storage.prototype.keys = function(){
    var keys = [];
    for (var i = 0; i < this.store.length; i++){
        keys[i] = this.store.key(i);
    }

    return keys;
};

/**
 * Remove item from store.
 * @param key
 */
Storage.prototype.remove = function(key){
    return this.store.removeItem(key);
};

/**
 * Set key value pair value.
 * @param key
 * @param value
 */
Storage.prototype.set = function(key, value){
    try{
        this.store.setItem(key, value);
    }
    catch (e) {
        console.error(e);
        if((e.name).toUpperCase() === 'QUOTA_EXCEEDED_ERR') {
            //TODO Replace with correct error handling.
            alert ("Unable to cache area, cache is full.");
        }
    }
};

/**
 * @return Cloud login details.
 */
Storage.prototype.getCloudLogin = function() {
    var login = {
        'id': undefined
    };
    var user = this.get('cloud-user');

    if(user &&
       user.length > 0 &&
       user != '[null]'){

        try{
            login = JSON.parse(user);
        }
        catch(error){
            // somethings went wrong with save, delete contents
            console.error("Problem with saved user:" + error);
            console.error(user);
            this.remove('cloud-user');
        }
    }

    return login;
};

/**
 * @return List of saved annotations in local storage.
 */
Storage.prototype.getSavedAnnotations = function() {
    var savedAnnotations = {};
    var savedAnnotationsObj = this.get('saved-annotations');

    if(savedAnnotationsObj &&
       savedAnnotationsObj.length > 0 &&
       savedAnnotationsObj != '[null]'){

        try{
            savedAnnotations = JSON.parse(savedAnnotationsObj);
        }
        catch(error){
            // somethings went wrong with save, delete contents
            console.error(error);
            this.remove('saved-annotations');
        }
    }

    return savedAnnotations;
};

/**
 * Save cloud login details.
 * @param id The user's id.
 * @param cursor Dropbox sync cursor.
 */
Storage.prototype.saveCloudLogin = function(id, cursor) {
    var user = {
        'id': id,
        'cursor': cursor
    }

    this.set('cloud-user', JSON.stringify(user));
};

/**
 * Mobile app setting class
 * @param options - properties object:
 *     db - HTML5 local storage wrapper
 */
var Settings = function(options) {
    this.db = options.db;

    var stored = options.db.get('settings');
    if(stored){
        this.vals = JSON.parse(stored);
    }
    else{
        this.vals = {
            locateInterval: 0,
            debugGPS: false,
        }
    }

    if(typeof(this.vals.pcapiUrl) === 'undefined'){
        this.vals.pcapiUrl = Settings.SERVER_URL_DEFAULT;
    }
    if(typeof(this.vals.mapserverUrl) === 'undefined'){
        this.vals.mapserverUrl = Settings.SERVER_URL_DEFAULT;
    }
};

Settings.SERVER_URL_DEFAULT = 'http://fieldtripgb.edina.ac.uk';

/**
 * @return Should GPS capture be run in debug mode?
 */
Settings.prototype.debugGPS = function(){
    return this.vals.debugGPS;
};

/**
 * @return Locate interval.
 */
Settings.prototype.getLocateInterval = function(){
    return this.vals.locateInterval;
};

/**
 * @return URL of the map server.
 */
Settings.prototype.getMapServerUrl = function(){
    return this.vals.mapserverUrl;
};

/**
 * @return Locate interval.
 */
Settings.prototype.getPcapiUrl = function(){
    return this.vals.pcapiUrl;
};

/**
 * Restore saved settings.
 */
Settings.prototype.restore = function(){
    Utils.selectVal("#settings-pcapi-url", this.vals.pcapiUrl);
    Utils.selectVal("#settings-mapserver-url", this.vals.mapserverUrl);
    Utils.sliderVal('#settings-debug-gps', this.vals.debugGPS);
};

/**
 * Save current settings.
 */
Settings.prototype.save = function(){
    this.vals.debugGPS = $('#settings-debug-gps').val() === 'on';
    this.vals.mapserverUrl = $('#settings-mapserver-url option:selected').val();
    this.vals.pcapiUrl = $('#settings-pcapi-url option:selected').val();

    this.db.set('settings', JSON.stringify(this.vals, undefined, 2));
};
