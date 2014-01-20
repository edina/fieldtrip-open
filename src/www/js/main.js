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


$(function() {
    if(window.location.href.substr(0, 4) === 'http'){
        onDeviceReady();
    }
    else{
        // problems with requirejs and cordova,
        // for the timebeing add it as a script tag
        $('head').append('<script src="' + 'cordova.js"></script>');
        document.addEventListener("deviceready", onDeviceReady, false);
    }
});

function onDeviceReady(){
    require.config({
        paths: {
            "plugins": "../plugins",
            "templates": "../templates",
            "theme": "../theme",
            "text": "ext/requirejs-text",
            "underscore": "ext/underscore",

        },
        shim: {
            "underscore": {
                exports: "_"
            }
        }
    });

    require(['ui'], function(ui) {
        $(document).on('pageinit', 'div[data-role="page"]', function(event){
            console.log("pageinit");
            ui.pageInit(event.currentTarget.id);
        });
        $(document).on('pagebeforeshow', 'div[data-role="page"]', function(event){
            console.log("pagebeforeshow");
            ui.pageChange();
        });
        $(document).on('pageshow', 'div[data-role="page"]', function(event){
            console.log("pageshow");
        });


        $(document).on('pageshow', '#home-page', function(){
            //ui.homePage();
        });
        $(document).on('pageshow', '#map-page', function(event){
            console.log('pageshow map-page');
            ui.mapPageShow();
        });
        $(document).on('pageshow', '#capture-page', function(){
            ui.capturePage();
        });

        $.getJSON('theme/plugins.json', function(f){
            $.each(f.plugins, function(name){
                require(["plugins/" + name + "/js/" + name], function(){
                    //console.log('=>');
                });
            });
        });

        // initialise home page first time
        ui.homePage();
    });
};
