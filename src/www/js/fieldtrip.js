"use strict";

define(function(){
    return{
        homePage: function(){
            //$('.home-button').addClass('ui-btn-active')
            toggleActive();
        },

        pageChange: function() {
            $.get('footer.html', function(data){
                $('div[data-role="footer"]').html(data).trigger('create');
            });
        },

        toggleActive: function(){
            console.log("=>");
            $.each('div[data-role="navbar"]', function(d){
                console.log(d);
            });
        }
    }
});
