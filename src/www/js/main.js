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
            "plugins": "../plugins",
            "proj4": "ext/proj4",
            "templates": "../templates",
            "text": "ext/requirejs-text",
            "theme": "../theme",
            'QUnit': 'ext/qunit',
            "underscore": "ext/underscore"
        },
        shim: {
            'QUnit': {
                exports: 'QUnit',
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

    require(['ui', 'map', 'tests/main'], function(ui, map, tests) {
        // called when all plugins are finished loading
        var pluginsComplete = function(){
            // when all plugins are finished loading finialise map
            map.postInit();

            // initialise home page first time
            ui.pageChange();
            ui.homePage();
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

        $(document).on('pageinit', 'div[data-role="page"]', function(event){
            // no use for this yet
        });
        $(document).on('pagebeforeshow', 'div[data-role="page"]', function(event){
            // no use for this yet
        });
        $(document).on('pageshow', 'div[data-role="page"]', function(event){
            ui.pageChange();
        });

        $(document).on('pageinit', '#map-page', function(){
            // map page is special case, need to setup up openlayers before onshow
            ui.mapPageInit();
        });

        $(document).on('pageremove', '#map-page', function(){
            ui.mapPageRemove();
        });

        var onShows = {
            'home-page': ui.homePage,
            'map-page': ui.mapPage,
            'capture-page': ui.capturePage,
            'annotate-page': ui.annotatePage,
            'annotate-preview-page': ui.annotatePreviewPage,
            'saved-records-page': ui.savedRecordsPage,
        };

        $.each(onShows, function(id, func){
            $(document).on('pageshow',
                           '#' + id,
                           $.proxy(func, ui));
        });
    });
}
