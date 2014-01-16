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

/**
 * TODO
 * @title
 * @module ui
 * @overview This is the overview with some `markdown` included, how nice!
 * text after
 */
define(['map'], function(map){

    map.init();

    // work out page height
    var resizePage = function(){
        var offset = 4;

        var h = $(window).height() - ($('.ui-page-active .ui-header').first().height() + $('.ui-page-active .ui-footer').first().height() + offset);
        $('[data-role=content]').css('height', h + 'px');
    };

    return{
        /**
         * TODO
         */
        capturePage: function(){
            console.log('capturePage');
        },

        /**
         * TODO
         */
        homePage: function(){
            console.log('homePage');
        },

        /**
         * TODO
         * text below
         */
        mapPage: function(){
            console.log('mapPage');
            //map.display('map');
            // set up buttons when records a visible on map
            var recordsVisible = function(){
                $('#map-records-buttons-ok .ui-btn-text').text('Hide Records');
                $('#map-records-buttons-list a').show();
            }

            // set up buttons when records are hidden
            var recordsHidden = function(){
                $('#map-records-buttons-ok .ui-btn-text').text('Show Records');
                $('#map-records-buttons-list a').hide();
            }

            $('#map-records-buttons-ok').click($.proxy(function(event){
                var label = $('#map-records-buttons-ok .ui-btn-text').text();
                if(label === 'Show Records'){
                    map.showRecordsLayer();
                    recordsVisible();
                }
                else{
                    this.map.hideAnnotationsLayer();
                    recordsHidden();
                }
            }, this));

            if(map.getRecordsLayer().visibility){
                recordsVisible();
            }
            else{
                recordsHidden();
            }

            map.showAnnotateLayer();
            //this.commonMapPageInit('map');
            //this.map.updateSize();

            // TODO -remove
            map.display('map');
        },

        /**
         * TODO
         */
        pageChange: function() {
            this.renderHeaderFooter();
            this.toggleActive();
            resizePage();
        },

        /**
         * with method
         * @method blah
         */
        toggleActive: function(){
            var id = $.mobile.activePage[0].id;
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

        /**
         * with method
         * @param page jings
         */
        renderHeaderFooter: function(){
            var page = $.mobile.activePage[0].id.split("-")[0];
            require(['renderer'], function(rndr) {
                rndr.init(page, 'header');
                rndr.init(page, 'footer');
            });
        }
    }
});
