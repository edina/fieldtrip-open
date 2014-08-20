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

/* global QUnit */

/**
 * Main fieldtrip open UI interface.
 */
define(['map', 'records', 'utils', 'settings', 'underscore', 'text!templates/saved-records-list-template.html'], function(// jshint ignore:line
    map, records, utils, settings, _, recrowtemplate){
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
        // note: obscure bug with dynamic loading of editors where the last form
        // control was grabbing focus.  This was 'fixed' by specifying a 'fade'
        // transition. see: http://devel.edina.ac.uk:7775/issues/4919

        // unbind is required as this is used in the home page
        $('.annotate-image-form').unbind();
        $('.annotate-image-form').on('vmousedown', function(){
            records.annotateImage();
        });

        $('.annotate-audio-form').unbind();
        $('.annotate-audio-form').on('vmousedown', function(){
            records.annotateAudio();
        });

        $('.annotate-text-form').unbind();
        $('.annotate-text-form').on('vmousedown', function(){
            records.annotateText();
        });

        $('.annotate-custom-form').unbind();
        $('.annotate-custom-form').on('vmousedown', function(event){
            // get the custom form type from the element id
            var id = $(event.target).parent().attr('id');
            records.annotate(id.substr(id.lastIndexOf('-') + 1));
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

            if($('.ui-page-active .ui-header').css('display') !== 'none'){
                header = $('.ui-page-active .ui-header').first().height();
            }
            if($('.ui-page-active .second-header').css('display') !== 'none'){
                secondHeader = $('.ui-page-active .second-header').first().height();
            }
            if($('.ui-page-active .ui-footer').css('display') !== 'none'){
                footer = $('.ui-page-active .ui-footer').first().height();
            }

            var h = $(window).height() - (header + footer + secondHeader);
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

    $(document).on(
        'vmousedown',
        '.user-locate',
        function(){
            geoLocate({
                watch: false,
                secretly: false,
                updateAnnotateLayer: false,
                useDefault: false
            });
        }
    );

    // only privileged user should see development section
    if(!utils.isPrivilegedUser()){
        $('#home-page-development').hide();
    }

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
            $('#home-show-eula').click(function(){
                window.open(utils.getServerUrl() + "/end-user-license-agreement",
                            '_blank',
                            'location=yes');
            });

            $('#home-accept-eula').on('vclick', function(){
                localStorage.setItem('eula-accepted', 'YES');
                $('.ui-footer').show();
                resizePage();
            });

            $('#home-splash-popup').on('vclick', function(){
                $('#home-splash-popup').popup('close');
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
                $('.ui-footer').hide();
            }
            else {
                // show normal popup
                $('#home-splash-popup').popup({history: false});
                $('#home-splash-popup').popup('open');
            }
        }
    },

    /**
     * Go to annotate screen.
     */
    annotatePage: function(){
        var type = localStorage.getItem('annotate-form-type');
        var id;
        records.initPage(type, $.proxy(function(){
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

                require(['audio'], function(audio){
                    parent.append(audio.getNode(url)).trigger('create');
                });
            }, this);

            // listen for take photo click
            $('.annotate-image-take').click($.proxy(function(event){
                id = $(event.target).parents('.ui-grid-a').attr('id');
                records.takePhoto(function(media){
                    showImage(id, media);
                });
            }, this));

            // listen for image gallery click
            $('.annotate-image-get').click($.proxy(function(event){
                id = $(event.target).parents('.ui-grid-a').attr('id');
                records.getPhoto(function(media){
                    showImage(id, media);
                });
            }, this));

            // listen for audio click
            $('.annotate-audio').click($.proxy(function(event){
                id = $(event.target).parents('div').attr('id');
                records.takeAudio(function(media){
                    showAudio(id, media);
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
                this.currentAnnotation = records.processAnnotation(type);
            }, this));

            // if annotation in progress repopulate fields
            if(this.currentAnnotation !== undefined){
                $('#' + records.TITLE_ID).val(this.currentAnnotation.record.name);
                $.each(this.currentAnnotation.record.fields, function(i, entry){
                    var fieldType = records.typeFromId(entry.id);
                    if(fieldType === 'text'){
                        $('#' + entry.id + ' input').val(entry.val);
                    }
                    else if(fieldType === 'textarea'){
                        $('#' + entry.id + ' textarea').val(entry.val);
                    }
                    else if(fieldType === 'image'){
                        showImage('annotate-image-0', entry.val);
                    }
                    else if(fieldType === 'audio'){
                        showAudio('annotate-audio-0', entry.val);
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

        if(localStorage.getItem('ignore-centre-on-annotation') === 'true'){
            map.updateAnnotateLayer();
            localStorage.setItem('ignore-centre-on-annotation', false);
        }
        else {
            geoLocate({
                watch: true,
                secretly: false,
                updateAnnotateLayer: true,
                useDefault: true
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
            var lonLat = map.getAnnotationCoords(false);
            records.saveAnnotationWithCoords(
                this.currentAnnotation,
                lonLat);

            // update default location to be last selected location
            map.setDefaultLocation(lonLat);

            utils.gotoMapPage($.proxy(function(){
                this.mapPageRecordCentred(this.currentAnnotation);
                this.currentAnnotation = undefined;
            }, this));
        }, this));

        utils.touchScroll('#annotate-preview-detail');

        map.hideRecordsLayer();
        map.updateSize();
    },

    /**
     * Set up capture page.
     */
    capturePage: function(){
        var blocks = ['a', 'b', 'c', 'd', 'e'];
        records.getEditors(function(editors){
            $.each(editors, function(i, editor){
                var name = editor.name.substr(0, editor.name.indexOf('.'));
                var html = '<div class="ui-block-' + blocks[i % 5] + '"><a id="annotate-custom-form-' + name + '" class="annotate-custom-form" href="#"><img src="css/images/custom.png"></a><p>' + name + '</p></div>';
                $('#capture-section2').append(html);
            });

            capturePageListeners();
        });
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

        // force redraw, specifically for closing of record details dialog
        resizePage();
    },

    /**
     * Map page init (on pagecreate).
     */
    mapPageInit: function(){
        $('#map-records-buttons-ok').click($.proxy(function(event){
            var label = $('#map-records-buttons-ok a').text().trim();
            if(label === 'Show Records'){
                this.mapPageRecordCentred();
            }
            else{
                map.hideRecordsLayer();
                this.mapPageRecordsHidden();
            }
        }, this));

        if(map.isRecordsLayerVisible()){
            this.mapPageRecordsVisible();
        }
        else{
            this.mapPageRecordsHidden();
        }

        map.startLocationUpdate();
        map.initCompass();
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
     * Set map page buttons when records are hidden.
     */
    mapPageRecordsHidden: function(){
        $('#map-records-buttons-ok a').text('Show Records');
        $('#map-records-buttons-list a').hide();
    },

    /**
     * Set up buttons when records are visible on map.
     */
    mapPageRecordsVisible: function(){
        $('#map-records-buttons-ok a').text('Hide Records');
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
        //$("[data-role=header]").fixedtoolbar({tapToggle: false});
        //$("[data-role=footer]").fixedtoolbar({tapToggle: false});

        resizePage();
        this.toggleActive();
    },

    /**
     * Show Saved Records.
     */
    savedRecordsPage: function(event){
        var annotations = records.getSavedRecords();

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

        var addAnnotation = function(id, annotation){
            var template = _.template(recrowtemplate);

            $('#saved-records-list-list').append(
                template({
                    "id": id,
                    "annotation": annotation,
                    "fields": annotation.record.fields,
                    "records": records
                })
            ).trigger('create');
        };

        $.each(annotations, function(id, annotation){
            if(annotation){
                addAnnotation(id, annotation);
            }
            else{
                // empty entry, just delete it
                delete annotations[id];
                records.setSavedAnnotations(annotations);
            }
        });

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
                $('#saved-records-delete-popup-name').text(
                    "'" + this.toBeDeleted.find('.saved-record-view a').text() + "'");
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
                if(this.isMobileApp){
                    // this will prevent the event propagating to next screen
                    event.stopImmediatePropagation();
                }

                var id = $(event.target).parents('li').attr('id');
                var annotation = records.getSavedRecord(id);

                // goto map page and show all records centred on record clicked
                utils.gotoMapPage($.proxy(this.mapPageRecordCentred, this, annotation));
            }, this)
        );
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
