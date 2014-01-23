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
 * TODO
 * @title
 * @module ui
 * @overview This is the overview with some `markdown` included, how nice!
 * text after
 */
define(['map', 'records', 'renderer', 'utils', 'settings'], function(
    map, records, renderer, utils, settings){

    var portraitScreenHeight;
    var landscapeScreenHeight;

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
     * Bind annotation form listeners.
     */
    var capturePageListeners = function(){
        // note: obscure bug with dynamic loading of editors where the last form
        // control was grabbing focus.  This was 'fixed' by specifying a 'fade'
        // transition. see: http://devel.edina.ac.uk:7775/issues/4919

        // unbind is required as this is used in the home page
        $('.annotate-image-form').unbind();
        $('.annotate-image-form').on('vmousedown', $.proxy(function(){
            localStorage.setItem('annotate-form-type', 'image');
            $.mobile.changePage('annotate.html', {transition: "fade"});
        }, this));

        $('.annotate-audio-form').unbind();
        $('.annotate-audio-form').on('vmousedown', $.proxy(function(){
            localStorage.setItem('annotate-form-type', 'audio');
            $.mobile.changePage('annotate.html',  {transition: "fade"});
        }, this));

        $('.annotate-text-form').unbind();
        $('.annotate-text-form').on('vmousedown', $.proxy(function(){
            localStorage.setItem('annotate-form-type', 'text');
            $.mobile.changePage('annotate.html',  {transition: "fade"});
        }, this));

        $('.annotate-custom-form').unbind();
        $('.annotate-custom-form').on('vmousedown', $.proxy(function(event){
            // get the custom form type from the element id
            var id = $(event.target).parent().attr('id');
            localStorage.setItem('annotate-form-type',
                                 id.substr(id.lastIndexOf('-') + 1));
            $.mobile.changePage('annotate.html', {transition: "fade"});
        }, this));
    };

    var exitApp = function(){
        $('#home-exit-popup').popup('open');

        $('#home-exit-confirm').off('vmousedown');
        $('#home-exit-confirm').on(
            'vmousedown',
            $.proxy(function(){
                // TODO - the gps track plugin needs to do this
                // ensure any running track is completed
                //this.annotations.gpsCaptureComplete();

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
    var geoLocate = function(options){
        if(typeof(options.secretly) === 'undefined'){
            options.secretly = false;
        }

        map.geoLocate({
            interval: settings.getLocateInterval(),
            secretly: options.secretly,
            updateAnnotateLayer: options.updateAnnotateLayer,
            useDefault: options.useDefault
        });
    };

    // work out page height
    var resizePage = function(){
        var offset = 0;

        var h = $(window).height() - ($('.ui-page-active .ui-header').first().height() + $('.ui-page-active .ui-footer').first().height() + offset);
        $('[data-role=content]').css('height', h + 'px');
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
                secretly: false,
                updateAnnotateLayer: false,
                useDefault: false
            });
        }
    );

    // listen for windows resizes
    $(window).bind('resize', $.proxy(resizeWindow, _ui));

    // switch off page transitions
    $.mobile.defaultPageTransition = 'none';

    map.init();

var _ui = {

    /**
     * Annotate option, show drag icon.
     */
    annotatePreviewPage: function(){
        //this.commonMapPageInit('annotate-preview-map');

        if(localStorage.getItem('ignore-centre-on-annotation') === 'true'){
            map.updateAnnotateLayer();
            localStorage.set('ignore-centre-on-annotation', false);
        }
        else {
            geoLocate({
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
            if(records.typeFromId(entry.id) === 'image'){
                $('#annotate-preview-detail-image').append(
                    '<img src="' + entry.val + '"></img>');
            }
            else{
                addMeta(entry.label, entry.val);
            }
        }, this));

        $('#annotate-preview-ok').click($.proxy(function(){
            this.records.saveAnnotationWithCoords(this.currentAnnotation);
            this.currentAnnotation = undefined;
            $.mobile.changePage('map.html');
        }, this));

        utils.touchScroll('#annotate-preview-detail');

        map.hideRecordsLayer();
        map.updateSize();
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
                parent.append(audioNode(url)).trigger('create');
            }, this);

            // listen for take photo click
            $('.annotate-image-take').click($.proxy(function(event){
                id = $(event.target).parents('.ui-grid-a').attr('id');
                this.records.takePhoto(function(media){
                    showImage(id, media);
                });
            }, this));

            // listen for image gallery click
            $('.annotate-image-get').click($.proxy(function(event){
                id = $(event.target).parents('.ui-grid-a').attr('id');
                this.records.getPhoto(function(media){
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
            $('input[value="Cancel"]').click($.proxy(function(){
                plugins.SoftKeyBoard.hide();
                // clear input fields
                this.currentAnnotation = undefined;
                window.history.back();
            }, this));

            // image size
            $('input[name="radio-image-size"]').bind ("change", function (event){
                if(this.value === Annotations.IMAGE_SIZE_FULL){
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

                if(typeof(plugins) !== 'undefined'){
                    plugins.SoftKeyBoard.hide();
                }

                // process the form
                this.currentAnnotation = records.processAnnotation(type);
            }, this));

            // if annotation in progress repopulate fields
            if(this.currentAnnotation !== undefined){
                $('#' + records.TITLE_ID).val(this.currentAnnotation.record.name);
                $.each(this.currentAnnotation.record.fields, function(i, entry){
                    var type = records.typeFromId(entry.id);
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
            utils.touchScroll('#annotate-form');
        }, this));
    },

    /**
     * TODO
     */
    capturePage: function(){
        //console.log('capturePage');
    },

    /**
     * TODO
     */
    homePage: function(event){
        if(event){
            event.stopImmediatePropagation();
        }

        //this.setUpExitButton();

        // TODO
        utils.touchScroll('#home-content');
        utils.absoluteHeightScroller('#splash-popup-dialog-content');
        utils.touchScroll('#splash-popup-dialog-content');

        // $(document).on('click', '#splash-popup-dialog a', function() {
        //     $('#splash-popup-dialog').popup('close');
        // });

        // the home page stays in memory so ui-btn-active must be added dynamically
        //$('.menu a:first').addClass('ui-btn-active');

        // check stored user id
        // this.annotations.cloudCheckUser($.proxy(function(state){
        //     if(state === 1){
        //         homepageDisplay.showLogoutAndSync();
        //     }
        //     else{
        //         this.logoutCloud();
        //     }
        // }, this));

        // enable / disable GPS track button
        //this.gpsButtonInit();

        capturePageListeners();

        // exit button
        $('#home-exit').unbind();
        $('#home-exit').on('click', exitApp);

        // $('#home-content-help').unbind();
        // $('#home-content-help').on('taphold', function(){
        //     $('#home-page-dev').show();
        // });
    },

    /**
     * TODO
     * text below
     */
    init: function(){
        geoLocate({
            secretly: true,
            updateAnnotateLayer: false,
            useDefault: true
        });
    },

    /**
     * TODO
     */
    mapPage: function(){
        map.display('map');
    },

    /**
     * TODO
     * text below
     */
    mapPageInit: function(){
        // set up buttons when records a visible on map
        var recordsVisible = function(){
            $('#map-records-buttons-ok .ui-btn-text').text('Hide Records');
            $('#map-records-buttons-list a').show();
        }

        // set up buttons when records are hidden
        var recordsHidden = function(){
            $('#map-records-buttons-ok .ui-btn-text').text('Show Records');
            $('#map-records-buttons-list a').hide();
        }

        $('#map-records-buttons-ok').click($.proxy(function(event){
            var label = $('#map-records-buttons-ok .ui-btn-text').text();
            if(label === 'Show Records'){
                map.showRecordsLayer();
                recordsVisible();
            }
            else{
                map.hideRecordsLayer();
                recordsHidden();
            }
        }, this));

        if(map.getRecordsLayer().visibility){
            recordsVisible();
        }
        else{
            recordsHidden();
        }

        map.showLocateLayer();
    },

    /**
     * TODO
     */
    pageChange: function() {
        resizePage();
        this.toggleActive();
    },

    /**
     * Show Saved Records.
     */
    savedRecordsPage: function(){
        //this.commonPageInit();
        var annotations = records.getSavedRecords();
        utils.printObj(annotations);

        var addAnnotation = function(id, annotation){
            $('#saved-records-list-list').append(
                '<li id="' + id + '"><div class="ui-grid-b"> \
<div class="ui-block-a saved-records-list-synced-' + annotation.isSynced + '">\
</div>\
<div class="ui-block-b saved-annotation-view">\
<a href="#">' + annotation.record.name + '</a>\
</div>\
<div class="ui-block-c">\
<a href="#" class="saved-record-delete" data-role="button" data-icon="delete" data-iconpos="notext" data-theme="a"></a>\
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
                this.records.setSavedAnnotations(annotations);
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
                var annotation = this.records.getSavedAnnotations()[id];
                var type = records.getEditorId(annotation);

                // TODO
                // if(type === 'track'){
                //     map.showGPSTrack(id, annotation);
                // }

                map.showAnnotationsLayer(annotation);
                $.mobile.changePage('map.html');
            }, this)
        );

        // TODO - move to plugin
        // sync / login button
        // $(document).off('vmousedown', '#saved-annotations-page-header-login-sync');
        // $(document).on(
        //     'vmousedown',
        //     '#saved-annotations-page-header-login-sync',
        //     $.proxy(function(event){
        //         event.stopImmediatePropagation();
        //         if($('#saved-annotations-page-header-login-sync.cloud-sync').length > 0){
        //             this.sync({
        //                 div: 'saved-annotation-sync-popup',
        //                 callback: function(add, id, annotation){
        //                     if(add){
        //                         addAnnotation(id, annotation);
        //                     }
        //                     else{
        //                         // if not add then delete
        //                         $('#' + id).slideUp('slow');
        //                     }
        //                 },
        //                 complete: function(){
        //                     $('#saved-annotations-list-list').listview('refresh');
        //                 }
        //             });
        //         }
        //         else{
        //             $.mobile.showPageLoadingMsg();

        //             // TODO - move to plugin
        //             this.records.cloudLogin($.proxy(function(){
        //                 $.mobile.hidePageLoadingMsg();
        //                 var userId = this.db.getCloudLogin().id;
        //                 if(userId){
        //                     $('#saved-annotations-page-header-login-sync').removeClass(
        //                         'cloud-login');
        //                     $('#saved-annotations-page-header-login-sync').addClass(
        //                         'cloud-sync');
        //                     $('#saved-annotations-page-header-upload').show();
        //                 }
        //             }, this));
        //         }
        //     }, this)
        // );

        // TODO - move to plugin
        // upload only
        // $(document).off('vmousedown', '#saved-annotations-page-header-upload');
        // $(document).on(
        //     'vmousedown',
        //     '#saved-annotations-page-header-upload',
        //     $.proxy(this.uploadRecords, this)
        // );

        // var userId = this.db.getCloudLogin().id;
        // if(userId){
        //     $('#saved-annotations-page-header-login-sync').addClass('cloud-sync');
        //     $('#saved-annotations-page-header-upload').show();
        // }
        // else{
        //     $('#saved-annotations-page-header-login-sync').addClass('cloud-login');
        // }

        // make records scrollable on touch screens
        //Utils.touchScroll('#saved-annotations-list');

        $('#saved-annotations-list-list').listview('refresh');
    },

    /**
     * with method
     * @method blah
     */
    toggleActive: function(){
        var id = $.mobile.activePage[0].id;
        if(id === 'map-page'){
            $('.map-button').addClass('ui-btn-active');
        }
        else if(id === 'capture-page'){
            $('.capture-button').addClass('ui-btn-active');
        }
        else{
            $('.home-button').addClass('ui-btn-active');
        }
    },

    /**
     * with method
     */

    // TODO can remove?
    setUpExitButton: function(){
    }

};

// var _ios = {
//     init: function(){
//     }
// };

// var _android = {
//     init: function(){
//     },
// };

// if(utils.isMobileDevice()){
//     var _this = {};
//     if(utils.isIOSApp()){
//         $.extend(_this, _ui, _ios);
//     }
//     else{
//         $.extend(_this, _ui, _android);
//     }

//     _this.init();
//     return _this;
// }
// else{
//     _ui.init();
//     return _ui;
// }
    _ui.init();
    return _ui;

});
