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

/* global QUnit */

/**
 * Main fieldtrip open UI interface.
 */
define(['map', 'records', 'audio', 'utils', 'settings', 'underscore'], function(// jshint ignore:line
    map, records, audio, utils, settings, _){
    var portraitScreenHeight;
    var landscapeScreenHeight;
    var menuClicked, searchClicked;

    var menuIds = {
        'home': ['home-page', 'settings-page'],
        'map': ['map-page'],
        'capture': ['capture-page', 'annotate-page', 'annotate-preview-page']
    };

    // record initial screen height
    if(window.orientation === 0 || window.orientation === 180){
        portraitScreenHeight = $(window).height();
        landscapeScreenHeight = $(window).width();
    }
    else{
        portraitScreenHeight = $(window).width();
        landscapeScreenHeight = $(window).height();
    }

    /**
     * bind annotation form listeners.
     */
    var capturePageListeners = function(){
        // unbind is required as this is used in the home page
        $('.annotate-image-form').unbind();
        $('.annotate-image-form').on('vclick', function(){
            records.annotateImage();
        });

        $('.annotate-audio-form').unbind();
        $('.annotate-audio-form').on('vclick', function(){
            records.annotateAudio();
        });

        $('.annotate-text-form').unbind();
        $('.annotate-text-form').on('vclick', function(){
            records.annotateText();
        });

        $('.annotate-custom-form').unbind();
        $('.annotate-custom-form').on('vclick', function(event){
            var $editor = $(event.currentTarget);

            var group = $editor.attr('data-editor-group');
            var type = $editor.attr('data-editor-type');

            if(group === undefined){
                group = records.EDITOR_GROUP.PRIVATE;
            }

            records.annotate(group, type);
        });
    };

    /**
     * Exit app, only appies to android
     */
    var exitApp = function(){
        $('#home-exit-popup').popup('open');

        $('#home-exit-confirm').off('vmousedown');
        $('#home-exit-confirm').on(
            'vmousedown',
            function(){
                map.trigger(map.EVT_BEFORE_EXIT);
                navigator.app.exitApp();
            }
        );
    };

    /**
     * Set map to user's location.
     * @param secrectly If true do not show page loading msg.
     * @param updateAnnotateLayer Should annotate layer be updated after geolocate?
     * @param useDefault If no user location found should default be used?
     */
    var geoLocate = function(options){
        if(typeof(options.secretly) === 'undefined'){
            options.secretly = false;
        }

        map.geoLocate({
            watch: false,
            secretly: options.secretly,
            updateAnnotateLayer: options.updateAnnotateLayer,
            useDefault: options.useDefault,
            autocentre: true
        });
    };

    /**
     * Menu button clicked.
     */
    var menuClick = function(){
        menuClicked = true;
        if(searchClicked){
            $('body').pagecontainer('change', 'settings.html');
        }

        setTimeout(function(){
            menuClicked = false;
        }, 2000);
    };

    /**
     * Work out page height.
     */
    var resizePage = function(){
        if($('.ui-dialog').length === 0){
            var header = 0;
            var secondHeader = 0;
            var footer = 0;
            var footerBottom = 0;
            var headerTop = 0;

            if($('.ui-page-active .ui-header').css('display') !== 'none'){
                var $header = $('.ui-page-active .ui-header').first();
                header = $header.outerHeight();
                headerTop = parseInt($header.css('top'));
            }
            if($('.ui-page-active .second-header').css('display') !== 'none'){
                secondHeader = $('.ui-page-active .second-header').first().outerHeight();
            }
            if($('.ui-page-active .ui-footer').css('display') !== 'none'){
                var $footer = $('.ui-page-active .ui-footer').first();
                footer = $footer.outerHeight();
                footerBottom = parseInt($footer.css('bottom'));
            }

            var h = $(window).height() -
                        (header + footer + secondHeader + footerBottom + headerTop);
            $('.ui-content').css('height', h + 'px');
        }
    };

    /**
     * Window has been resized, with by orientation change of by the appearance of
     * the keyboard. A bug in JQM with some versions of android leaves the footer
     * remains visible when the keyboard is visible. This function hides the footer.
     */
    var resizeWindow = function(){
        // recording landscape height from potrait and vis-versa is not exact,
        // so add a little tolerance
        var tolerance = 30;
        var keyboardVisible;

        if((window.orientation === 0 || window.orientation === 180) &&
           ((window.innerHeight + tolerance) < portraitScreenHeight)){
            console.debug("keyboard visible: " + window.innerHeight + " : " +
                          portraitScreenHeight);
            keyboardVisible = true;
        }
        else if((window.innerHeight + tolerance) < landscapeScreenHeight){
            console.debug("keyboard visible: " + window.innerHeight + " : " +
                          landscapeScreenHeight);
            keyboardVisible = true;
        }

        if(keyboardVisible){
            $("[data-role=footer]").hide();
        }
        else{
            $("[data-role=footer]").show();
            resizePage();
        }
    };

    /**
     * Menu button clicked.
     */
    var searchClick = function(){
        searchClicked = true;

        if(menuClicked){
            $('body').pagecontainer('change', 'settings.html');
        }

        setTimeout(function(){
            searchClicked = false;
        }, 2000);
    };

    // map zooming
    $(document).on('click',
                   '.map-zoom-button-in',
                   $.proxy(map.zoomIn, map));
    $(document).on('click',
                   '.map-zoom-button-out',
                   $.proxy(map.zoomOut, map));

    $(document).on('tap',
                   '.user-locate',
                   $.proxy(map.panToLocationMarker, map));

    // attach the play function to the audio button
    $(document).on('vclick', '#annotate-audio-button', function(event) {
        audio.playAudio();
    });

    // listen for windows resizes
    $(window).bind('resize', $.proxy(resizeWindow, _ui));

    document.addEventListener("menubutton", menuClick, false);
    document.addEventListener("searchbutton", searchClick, false);

    // switch off page transitions
    $.mobile.defaultPageTransition = 'none';

    /************************** public interface  ******************************/

var _ui = {

    /**
     * Initialise module.
     */
    init: function(){

        if(utils.showStartPopup()){
            $('a.external-link').on('vclick', function(evt){
                evt.preventDefault();

                window.open(evt.currentTarget.href,
                            '_system',
                            'location=yes');
            });

            $('#home-accept-eula').on('vclick', function(){
                localStorage.setItem('eula-accepted', 'YES');
                $('.ui-footer').show();
                resizePage();
            });

            $('#home-splash-popup').on('vclick', function(){
                $('#home-splash-popup').popup('close');
                //stop propagation
                return false;
            });

            $.ajax({
                url: utils.getServerUrl() + "/splash.html",
                success:function(result) {
                    if(result) {
                        $('#home-splash-popup-message').html(result);
                    }

                },
                cache: false
            });

            // show terms and conditions
            if(localStorage.getItem('eula-accepted') === null){
                $('#home-eula-popup').popup({dismissible: false});
                $('#home-eula-popup').popup('open');
            }
            else {
                // show normal popup
                $('#home-splash-popup').popup({history: false});
                $('#home-splash-popup').popup('open');
            }
        }

        // check if records need converting
        records.convertCheck();

        this.pageChange();
        this.homePage();
    },

    /**
     * Go to annotate screen.
     */
    annotatePage: function(){
        var group = localStorage.getItem('annotate-form-group');
        var type = localStorage.getItem('annotate-form-type');

        var id;
        records.initPage(group, type, $.proxy(function(){
            // replace photo form element with image
            var showImage = function(id, url, type){
                var parent = $('#' + id).parent();
                //if type is image==single image then hide the take image buttons
                if(type==="image"){
                    $('#' + id).hide();
                }
                parent.append('<div class="annotate-image"><img src="' +
                              url + '"</img></div>');
            };

            // replace audio form element with audio control
            var showAudio = $.proxy(function(id, url, options){
                var parent = $('#' + id).parent();
                $('#' + id).hide();

                require(['audio'], function(audio){
                    parent.append(audio.getNode(url, options)).trigger('create');
                });
            }, this);

            // listen for take photo click
            $('.annotate-image-take').click($.proxy(function(event){
                id = $(event.target).parents('.image-chooser').attr('id');
                records.takePhoto(function(media){
                    showImage(id, media, records.typeFromId(id));
                });
            }, this));

            // listen for image gallery click
            $('.annotate-image-get').click($.proxy(function(event){
                id = $(event.target).parents('.image-chooser').attr('id');
                records.getPhoto(function(media){
                    showImage(id, media, records.typeFromId(id));
                });
            }, this));

            // listen for audio click
            $('.annotate-audio').click($.proxy(function(event){
                id = $(event.target).parents('div').attr('id');
                records.takeAudio(function(media){
                    showAudio(id, media.url, media);
                });
            }, this));

            // cancel button
            $('input[value="Cancel"]').click($.proxy(function(){
                utils.hideKeyboard();

                // clear input fields
                this.currentAnnotation = undefined;
                window.history.back();
            }, this));

            // image size
            $('input[name="radio-image-size"]').bind ("change", function (event){
                if(this.value === records.IMAGE_SIZE_FULL){
                    localStorage.setItem(records.IMAGE_UPLOAD_SIZE,
                                         records.IMAGE_SIZE_FULL);
                    utils.inform('Note : Larger images will take a longer time to sync',
                                 5000);
                }
                else{
                    localStorage.setItem(records.IMAGE_UPLOAD_SIZE,
                                         records.IMAGE_SIZE_NORMAL);

                }
            });

            // submit form
            $('#annotate-form').submit($.proxy(function(event){
                // cancels the form submission
                event.preventDefault();

                utils.hideKeyboard();

                // process the form
                this.currentAnnotation = records.processAnnotation(group, type);
            }, this));

            // if annotation in progress repopulate fields
            if(this.currentAnnotation !== undefined){
                $('#' + records.TITLE_ID).val(this.currentAnnotation.record.name);
                $.each(this.currentAnnotation.record.properties.fields, function(i, entry){
                    var fieldType = records.typeFromId(entry.id);
                    if(typeof(entry.val) !== 'undefined'){
                        if(fieldType === 'text'){
                            $('#' + entry.id + ' input').val(entry.val);
                        }
                        else if(fieldType === 'textarea'){
                            $('#' + entry.id + ' textarea').val(entry.val);
                        }
                        else if(fieldType === 'image'){
                            showImage('annotate-image-0', entry.val, fieldType);
                        }
                        else if(fieldType === 'multiimage'){
                            showImage('annotate-image-0', entry.val, fieldType);
                        }
                        else if(fieldType === 'audio'){
                            showAudio('annotate-audio-0', entry.val, {label: entry.val});
                        }
                        else if(fieldType === 'checkbox'){
                            $.each(entry.val.split(','), function(j, name){
                                $('input[value=' + name + ']').prop('checked', true).checkboxradio('refresh');
                            });
                        }
                        else if(fieldType === 'radio'){
                            $('#' + entry.id + ' input[value=' + entry.val + ']').prop(
                                "checked", true).checkboxradio("refresh");
                        }
                        else if(fieldType === 'range'){
                            $('#' + entry.id + ' input').val(entry.val);
                            $('#' + entry.id + ' input').slider('refresh');
                        }
                        else if(fieldType === 'select'){
                            $('#' + entry.id + ' select').val(entry.val).attr(
                                "selected", true).selectmenu("refresh");
                        }
                        else{
                            console.warn("Unknown field type: " + fieldType);
                        }
                    }
                });
            }

            // ensure page is scrollable
            utils.touchScroll('#annotate-form');
        }, this));
    },

    /**
     * Annotate option, show drag icon.
     */
    annotatePreviewPage: function(){
        map.display('annotate-preview-map');
        //generate map controls if there are configured inside the form
        var geometryObjects = JSON.parse(sessionStorage.getItem("editor-metadata")).geometryTypes || ['point'];
        var polygonWidgetTpl = _.template(
            '<a href="#" data-role="button" data-icon="capture-<%= geometry %>" data-iconpos="notext"><%= geometry %></a>'
        );

        var createToolBar = function() {
            var $item = $(".map-control-buttons");
            var html = [];
            html.push('<div data-role="controlgroup" data-type="vertical" class="map-control-buttons">');

            html.push(polygonWidgetTpl({
                geometry: "drag"
            }));
            for(var i=0; i<geometryObjects.length; i++){
                html.push(polygonWidgetTpl({
                    geometry: geometryObjects[i]
                }));
            }
            html.push('</div>');

            $item.append(html.join(""));
            $item.trigger('create');
        };

        if(localStorage.getItem('ignore-centre-on-annotation') === 'true'){
            map.updateAnnotateLayer();
            localStorage.setItem('ignore-centre-on-annotation', false);
        }
        else {
            var updateAnnotate = true;
            if(geometryObjects[0] !== "point" || geometryObjects.length > 1){
                updateAnnotate = false;
                map.showAnnotateLayer();
                createToolBar();
            }
            geoLocate({
                secretly: false,
                updateAnnotateLayer: updateAnnotate,
                useDefault: false
            });
        }

        var addMeta = function(label, text){
            $('#annotate-preview-detail-meta').append(
                '<p><span>' + label + '</span>: ' + text + '</p>');
        };
        $('.non-map-body-white h2').text(this.currentAnnotation.record.name + ' Details');

        $.each(this.currentAnnotation.record.properties.fields, $.proxy(function(i, entry){
            if(records.typeFromId(entry.id) === 'image'){
                $('#annotate-preview-detail-image').append(
                    '<img src="' + entry.val + '"></img>');
            }
            else{
                addMeta(entry.label, entry.val);
            }
        }, this));

        $('#annotate-preview-ok').click($.proxy(function(){
            var coords = map.getAnnotationCoords(false);
            records.saveAnnotationWithCoords(
                this.currentAnnotation,
                coords.geometry);

            // update default location to be last selected location
            map.setDefaultLocation(coords.centroid);

            utils.gotoMapPage($.proxy(function(){
                this.mapPageRecordCentred(this.currentAnnotation);
                this.currentAnnotation = undefined;
                map.enableControl("drag", false);
            }, this));
        }, this));

        utils.touchScroll('#annotate-preview-detail');

        map.enableControl(geometryObjects[0], false);
        $(".map-control-buttons a").click(function(){
            var controlName = $(this).data("icon").split("-")[1];
            map.enableControl(controlName, true);
        });

        $("#preview-record").click(function(){
            $("#map-preview-record-popup").popup('open');
        });

        map.hideRecordsLayer();
        map.updateSize();
    },

    /**
     * Set up capture page.
     */
    capturePage: function(){
        var blocks = ['a', 'b', 'c', 'd', 'e'];

        var editorToHTML = function(index, group, editor){
            var html = '<div class="ui-block-' + blocks[index % 5] + '">\
                          <a \
                            class="' + editor['class'] + '" \
                            data-editor-type="' + editor.type +'"\
                            data-editor-group="'+ editor.group +'"\
                            href="#">\
                              <img src="css/images/custom-'+group+'.png"> \
                          </a>\
                          <p>' + editor.title + '</p>\
                        </div>';
            return html;
        };

        var appendEditorButtons = function(group, section){
            var editors = records.getEditorsByGroup(group);
            var i = 0;
            for(var key in editors){
                if(editors.hasOwnProperty(key)){
                    var editor = editors[key];
                    var html = editorToHTML(i, group, editor);
                    $(section).append(html);
                    i++;
                }
            }
        };

        appendEditorButtons(records.EDITOR_GROUP.PRIVATE, '#capture-section2');
        appendEditorButtons(records.EDITOR_GROUP.PUBLIC, '#capture-section2');

        capturePageListeners();
    },

    /**
     * Set up home page.
     */
    homePage: function(event){
        capturePageListeners();

        utils.touchScroll('#home-content');

        $('.help-block a').unbind();
        $('.help-block a').on('taphold', function(){
            $('body').pagecontainer('change', 'settings.html');
        });

        // exit button
        $('#home-exit').unbind();
        $('#home-exit').on('click', exitApp);

        // only privileged user should see development section
        if(utils.isPrivilegedUser() || utils.isDeveloper()){
            $('#home-page-development').show();
        }else{
            $('#home-page-development').hide();
        }
    },

    /**
     * Set up maps page (on _pageshow).
     */
    mapPage: function(divId){
        if(typeof(divId) !== 'string'){
            divId = 'map';
        }

        // map render must happen in pageshow
        map.display(divId);

        // for leaflet enabling and disabling layers must come after display
        map.showLocateLayer();
        map.hideAnnotateLayer();

        map.startLocationUpdate();
        map.startCompass();

        map.initLayersPanel();
    },

    /**
     * Map page init (on pagecreate).
     */
    mapPageInit: function(){
        // Set map page buttons when records are hidden.
        var mapPageRecordsHidden = function(){
            $('#map-records-buttons-ok a span').text('Show');
            $('#map-records-buttons-list a').hide();
        };

        $('#map-records-buttons-ok').click($.proxy(function(event){
            var label = $('#map-records-buttons-ok a').text().trim();
            if(label.indexOf('Show') > -1){
                this.mapPageRecordCentred();
            }
            else{
                map.hideRecordsLayer();
                mapPageRecordsHidden();
            }
        }, this));

        if(map.isRecordsLayerVisible()){
            this.mapPageRecordsVisible();
        }
        else{
            mapPageRecordsHidden();
        }
    },

    /**
     * Set up map page with record centred.
     * @param annotation The record/annotation to centre on. Can be left undefined
     * to leave map centred as is.
     */
    mapPageRecordCentred: function(annotation){
        map.showRecordsLayer(annotation);
        this.mapPageRecordsVisible();
    },

    /**
     * Set up buttons when records are visible on map.
     */
    mapPageRecordsVisible: function(){
        $('#map-records-buttons-ok a span').text('Hide');
        $('#map-records-buttons-list a').show();
    },

    /*
     * Map page remove
     */
    mapPageRemove: function(){
        map.stopLocationUpdate();
        map.stopCompass();
    },

    /**
     * Function is called each time a page changes.
     */
    pageChange: function(){
        resizePage();
        i18n.init({// jshint ignore:line
            ns: { namespaces: ['index'], defaultNs: 'index'},
            lngWhitelist: ['en', 'de', 'gr', 'cy']
        }, function(){
            $("html").i18n();
        });
        this.toggleActive();
    },

    /**
     * Show Saved Records.
     */
    savedRecordsPage: function(event){
        var annotations = records.getSavedRecords();
        //records.printRecords();

        /**
         * toggleDisplay
         * takes an id (either records-list or records-grid),
         * adds to local storage and toggles layout button and
         * grid or list layout style
         */
        function toggleDisplay(id) {
            // store preference so it persists
            localStorage.setItem('records-layout', id);

            // Get the button and ensure it's active
            var button  = $('#' + id);
            button.toggleClass('ui-btn-active', true);

            // Remove active class from any other buttons
            $.each(button.siblings('a'), function (key, value) {
                $(value).toggleClass('ui-btn-active', false);
            });

            var isGrid = id === 'records-grid';
            $('#saved-records-page .ui-listview li').toggleClass('active', isGrid);
            $('.record-extra').toggle(isGrid);
        }

        records.addAnnotations(annotations);

        // Annotations loaded at this point so we can setup layout
        // Check if preference previously set
        toggleDisplay(localStorage.getItem('records-layout'));

        // delete a saved record
        $(document).off('click', '.saved-records-delete');
        $(document).on(
            'click',
            '.saved-records-delete',
            $.proxy(function(event){
                this.toBeDeleted = $(event.target).parents('li');
                // open dialog for confirmation
                $('#saved-record-delete-popup-name').text(
                    "'" + this.toBeDeleted.find('.saved-records-view a').text() + "'");
                $('#saved-records-delete-popup').popup('open');
            }, this)
        );

        // delete confirm
        $('#saved-record-delete-confirm').click($.proxy(function(event){
            var id = $(this.toBeDeleted).attr('id');
            records.deleteAnnotation(id, true);
            map.refreshRecords();
            $('#saved-records-delete-popup').popup('close');
            this.toBeDeleted.slideUp('slow');
        }, this));

        // Toggle List/Grid Layout
        $('#layout-toggle a').on('click', function (e) {
            toggleDisplay($(e.currentTarget).attr('id'));
        });

        // click on a record
        $(document).off('click', '.saved-records-view');
        $(document).on(
            'click',
            '.saved-records-view',
            $.proxy(function(event){
                if(utils.isMobileDevice()){
                    // this will prevent the event propagating to next screen
                    event.preventDefault();
                }

                var id = $(event.target).parents('li').attr('id');
                var annotation = records.getSavedRecord(id);

                // goto map page and show all records centred on record clicked
                utils.gotoMapPage($.proxy(this.mapPageRecordCentred, this, annotation));
            }, this)
        );
    },

    /**
     * Initialise settings page.
     */
    settingsPage: function(){
        $('#settings-clear-local-storage a').click(function(){
            localStorage.clear();
            utils.inform('done');
        });

        settings.init();
    },

    /**
     * Setting page has closed, save state.
     */
    settingsPageRemove: function(){
        settings.save();
    },

    /**
     * Toggle current active tab.
     */
    toggleActive: function(){
        $(".ui-footer .ui-btn").removeClass('ui-btn-active');
        var id = $('body').pagecontainer('getActivePage').get(0).id;
        $.each(menuIds, function(menu, ids){
            if($.inArray(id, ids) != -1){
                $('#' + id + ' .' + menu + '-button').addClass('ui-btn-active');
                return;
            }
        });
    },

    /**
     * Initialise toggle active list.
     * @param projectIds Project id list.
     */
    toggleActiveInit: function(projectIds){
        $.extend(menuIds, projectIds);
    },
};

_ui.init();
return _ui;

});
