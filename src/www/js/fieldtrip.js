"use strict";

define(function(){
    return{
        homePage: function(){
            console.log('homePage');
            this.pageChange();
        },

        mapPage: function(){
            console.log('mapPage');
        },

        pageChange: function() {
            $.get('footer.html', $.proxy(function(data){
                $('div[data-role="footer"]').html(data).trigger('create');
                this.toggleActive();
            }, this));
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
    }
});
