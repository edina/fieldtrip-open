"use strict";

// Start the main app logic.
require(['fieldtrip'], function(ft) {
    console.log('=>');

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

    ft.homePage();
});
