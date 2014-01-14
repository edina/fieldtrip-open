"use strict";

// Start the main app logic.
require(['fieldtrip'], function(ft) {
    console.log('=>');

    $(document).on('pageinit', 'div[data-role="page"]', function(){
        console.log('pageinit');
    });
    $(document).on('pagebeforeshow', 'div[data-role="page"]', function(){
        console.log('pagebeforeshow');
        ft.pageChange();
    });
    $(document).on('pageshow', 'div[data-role="page"]', function(){
        console.log('pageshow');
    });

    console.log(ft.pageChange());
});
