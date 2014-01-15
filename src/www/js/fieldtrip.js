"use strict";

define(['map'], function(map){


    return{
        homePage: function(){
            console.log('homePage');
            this.pageChange();
            this.render_header_footer('home');
        },

        mapPage: function(){
            console.log('mapPage');
            this.render_header_footer('map');
        },

        pageChange: function() {
            console.log('changePage');
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
        render_header_footer: function(page){
            require(['renderer'], function(rndr) {
                rndr.init(page, 'header');
                rndr.init(page, 'footer');
            });
        }
    }
});
