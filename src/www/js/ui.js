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

/**
 * TODO
 * @title
 * @module ui
 * @overview This is the overview with some `markdown` included, how nice!
 * text after
 */
define(['map'], function(map){
    var portraitScreenHeight;
    var landscapeScreenHeight;

    // record initial screen height
    if(window.orientation === 0 || window.orientation === 180){
        portraitScreenHeight = $(window).height();
        landscapeScreenHeight = $(window).width();
    }
    else{
        portraitScreenHeight = $(window).width();
        landscapeScreenHeight = $(window).height();
    }

    // work out page height
    var resizePage = function(){
        var offset = 0;

        var h = $(window).height() - ($('.ui-page-active .ui-header').first().height() + $('.ui-page-active .ui-footer').first().height() + offset);
        $('[data-role=content]').css('height', h + 'px');
    };

    /**
     * Window has been resized, with by orientation change of by the appearance of
     * the keyboard. A bug in JQM with some versions of android leaves the footer
     * remains visible when the keyboard is visible. This function hides the footer.
     */
    var resizeWindow = function(){
        // recording landscape height from potrait and vis-versa is not exact,
        // so add a little tolerance
        var tolerance = 30;
        var keyboardVisible;

        if((window.orientation === 0 || window.orientation === 180) &&
           ((window.innerHeight + tolerance) < portraitScreenHeight)){
            console.debug("keyboard visible: " + window.innerHeight + " : " +
                          portraitScreenHeight);
            keyboardVisible = true;
        }
        else if((window.innerHeight + tolerance) < landscapeScreenHeight){
            console.debug("keyboard visible: " + window.innerHeight + " : " +
                          landscapeScreenHeight);
            keyboardVisible = true;
        }

        if(keyboardVisible){
            $("[data-role=footer]").hide();
        }
        else{
            $("[data-role=footer]").show();
            resizePage();
        }
    };

    // map zooming
    $(document).on('click',
                   '.map-zoom-button-in',
                   $.proxy(map.zoomIn, map));
    $(document).on('click',
                   '.map-zoom-button-out',
                   $.proxy(map.zoomOut, map));

    // listen for windows resizes
    $(window).bind('resize', $.proxy(resizeWindow, _this));

    // switch off page transitions
    $.mobile.defaultPageTransition = 'none';

    map.init();

var _this = {
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
    mapPageInit: function(){
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
                map.hideRecordsLayer();
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
        //map.display('map');
    },

    mapPageShow: function(){
        map.display('map');
    },

    /**
     * TODO
     */
    pageChange: function() {
        $("[data-role=header]").fixedtoolbar({tapToggle: false});
        $("[data-role=footer]").fixedtoolbar({tapToggle: false});

        console.log("pageChange");
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
     */
    renderHeaderFooter: function(){
        console.log("renderHeaderFooter");
        var page = $.mobile.activePage[0].id.split("-")[0];
        console.log(page);
        require(['renderer'], function(rndr) {
            console.log("renderHeaderFooter");
            rndr.init(page, 'header');
            rndr.init(page, 'footer');
        });
    }
}

return _this;
});
