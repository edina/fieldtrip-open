"use strict";

define(['map'], function(map){

    return{
        homePage: function(){
            console.log('homePage');
            this.pageChange();
        },

        mapPage: function(){
            console.log('mapPage');
        },

        pageChange: function() {

        },

        toggleActive: function(){
            var id = $.mobile.activePage[0].id
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

        updateFooter: function(){
        },
    }
});
