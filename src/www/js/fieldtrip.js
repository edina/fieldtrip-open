/*
Copyright (c) 2014, EDINA,
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

define(['map'], function(map){

    map.init();

    return{
        capturePage: function(){
            console.log('capturePage');
        },

        homePage: function(){
            console.log('homePage');
            this.render_header_footer('home');
        },

        mapPage: function(){
            console.log('mapPage');
            map.display('map');
            this.render_header_footer('map');
        },

        pageChange: function() {
            console.log('changePage');
            this.toggleActive();
            this.resizePage();
        },

        toggleActive: function(){
            var id = $.mobile.activePage[0].id
            console.log(id);
            if(id === 'map-page'){
                $('.map-button').addClass('ui-btn-active');
            }
            else if(id === 'capture-page'){
                $('.capture-button').addClass('ui-btn-active');
            }
            else{
                $('.home-button').addClass('ui-btn-active');
            }
            console.log('end');
        },

        resizePage: function(){
            // work out page height
            var offset = 4;

            var h = $(window).height() - ($('.ui-page-active .ui-header').first().height() + $('.ui-page-active .ui-footer').first().height() + offset);
            $('[data-role=content]').css('height', h + 'px');
        },

        render_header_footer: function(page){
            require(['renderer'], function(rndr) {
                rndr.init(page, 'header');
                rndr.init(page, 'footer');
            });
        }
    }
});
