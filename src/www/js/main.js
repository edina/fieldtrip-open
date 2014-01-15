"use strict";

$(function() {
    if (typeof (device) === 'undefined'){
        onDeviceReady();
    }
    else{
        require(['cordova'], function(){
            document.addEventListener("deviceready", onDeviceReady, false);
        });
    }
});

function onDeviceReady(){
    require.config({
        paths: {
            "plugins": "../plugins",
            "templates": "../templates",
        },
    });



    require(['fieldtrip', 'renderer'], function(ft, rndr) {
        rndr.init('header');
        rndr.init('footer');
        
        $(document).on('pageinit', 'div[data-role="page"]', function(){
            console.log('pageinit');
        });
        $(document).on('pagebeforeshow', 'div[data-role="page"]', function(a){
            ft.pageChange();
        });
        $(document).on('pageshow', 'div[data-role="page"]', function(){
            console.log('pageshow');
        });

        $(document).on('pageinit', '#home-page', function(){
            ft.homePage();
        });
        $(document).on('pageinit', '#map-page', function(){
            ft.mapPage();
        });
        $(document).on('pageinit', '#map-page', function(){
            ft.mapPage();
        });

        $.get('plugins.json', function(f){
            $.each(f.plugins, function(name){
                require(["plugins/" + name + "/js/" + name], function(){
                    console.log('=>');
                });
            });
        });

        ft.homePage();
    });
};
