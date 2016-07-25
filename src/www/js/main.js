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

$(function() {
    if(window.location.href.substr(0, 4) === 'http'){
        onDeviceReady();
    }
    else{
        document.addEventListener("deviceready", onDeviceReady, false);
    }
});

function onDeviceReady(){
    // set up requirejs config
    require.config({
        paths: {
            "leaflet": "ext/leaflet",
            "plugins": "../plugins",
            "proj4": "ext/proj4",
            "templates": "../templates",
            "text": "ext/requirejs-text",
            "theme": "../theme",
            'QUnit': 'ext/qunit',
            "underscore": "ext/underscore"
        },
        shim: {
            "QUnit": {
                exports: "QUnit",
                init: function() {
                    QUnit.config.autoload = false;
                    QUnit.config.autostart = false;
                }
            },
            "underscore": {
                exports: "_"
            }
        }
    });

    require(['i18n', 'ui', 'map', 'records', 'tests/main'], function(i18n, ui, map, records, tests) {
        // called when all plugins are finished loading
        var pluginsComplete = function(){
            // initialise home page first time
            ui.init();
            records.loadEditorsFromFS();
        };

        // set up fieldtrip plugins
        $.getJSON('theme/project.json', function(f){
            var fieldtrip = f.plugins.fieldtrip;
            var noOfPlugins = Object.keys(fieldtrip).length;

            if(noOfPlugins > 0){
                var loaded = 0;
                $.each(fieldtrip, function(name){
                    require(["plugins/" + name + "/js/" + name], function(){
                        console.debug(name + " loaded");
                        ++loaded;

                        if(loaded === noOfPlugins){
                            pluginsComplete();
                        }
                    });
                });
            }
            else{
                pluginsComplete();
            }
        });

        $.getJSON('theme/menu-ids.json', function(ids){
            ui.toggleActiveInit(ids);
        });

        $(document).on('pagecreate', '#map-page', function(){
            // map page is special case, need to setup up openlayers before onshow
            ui.mapPageInit();
        });

        // set up onshow listeners
        var onShows = {
            'annotate-page': ui.annotatePage,
            'annotate-preview-page': ui.annotatePreviewPage,
            'capture-page': ui.capturePage,
            'home-page': ui.homePage,
            'map-page': ui.mapPage,
            'saved-records-page': ui.savedRecordsPage,
            'settings-page': ui.settingsPage
        };

        /*
              This event is being used as a hack to fix a problem in iOS
              where the form button is not rendered after the user navigates
              away from the home page. Hopefully we'll find a better solution.
              https://github.com/edina/fieldtrip-cps/issues/16
        */

        $(document).on("pagecontainertransition", function (e, eui) {
                    if(eui.prevPage[0].id === 'home-page'){
                        ui.homePageRemove();
                    }
                });

        /* pageshow event is being deprecated in jquery 1.4 but due to the
           fieldtrip-open architecture, plugins relay in that event in order to
           initialize its views as pagecreate is deprecated but still present
           _pageshow is triggered.
         */
        $(document).on('pagecontainershow', function(){
            var $page = $('body').pagecontainer('getActivePage');
            ui.pageChange();
            $page.trigger('_pageshow');
        });

        $.each(onShows, function(page, fun){
            var selector = '#' + page;
            $(document).on('_pageshow', selector, function(){
                fun.call(ui);
            });
        });

        // set up onremove listeners
        var onRemoves = {
            'map-page': ui.mapPageRemove,
            'settings-page': ui.settingsPageRemove
        };

        $.each(onRemoves, function(id, func){
            $(document).on('pageremove',
                           '#' + id,
                           $.proxy(func, ui));
        });
    });
}
