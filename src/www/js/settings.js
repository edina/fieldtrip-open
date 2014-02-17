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
 */
define(['config'], function(config){
    // TODO use config instead
    var SERVER_URL_DEFAULT = 'http://fieldtripgb.edina.ac.uk';
    var stored = localStorage.getItem('settings');
    var vals;

    if(stored){
        vals = JSON.parse(stored);
    }
    else{
        vals = {
            locateInterval: 0,
            debugGPS: false,
        }
    }

    if(typeof(vals.pcapiUrl) === 'undefined'){
        vals.pcapiUrl = SERVER_URL_DEFAULT;
    }
    if(typeof(vals.mapserverUrl) === 'undefined'){
        vals.mapserverUrl = SERVER_URL_DEFAULT;
    }

    var settingsPage = function(){
        require(['utils'], function(utils){
            $('#settings-clear-local-storage').click(function(){
                localStorage.clear();
                utils.inform('done')
            });

            $('#settings-ftgb').text(utils.version);
            $('#settings-jquery').text($().jquery);
            $('#settings-jqm').text(jQuery.mobile.version);
            $('#settings-ol').text(OpenLayers.VERSION_NUMBER);

            if(utils.isMobileDevice()){
                $('#settings-cordova').text(device.cordova);
            }
            else{
                $('#settings-cordova').text('n/a');
            }
        });
    };

    $(document).on('pageshow', '#settings-page', settingsPage);

return{

    /**
     * @return Should GPS capture be run in debug mode?
     */
    debugGPS: function(){
        return vals.debugGPS;
    },

    /**
     * @return Locate interval.
     */
    getLocateInterval: function(){
        return vals.locateInterval;
    },

    /**
     * @return URL of the map server.
     */
    getMapServerUrl: function(){
        return vals.mapserverUrl;
    },

    /**
     * TODO
     */
    getPcapiUrl: function(){
        return vals.pcapiUrl;
    },

    /**
     * Restore saved settings.
     */
    restore: function(){
        utils.selectVal("#settings-pcapi-url", vals.pcapiUrl);
        utils.selectVal("#settings-mapserver-url", vals.mapserverUrl);
        utils.sliderVal('#settings-debug-gps', vals.debugGPS);
    },

    /**
     * Save current settings.
     */
    save: function(){
        vals.debugGPS = $('#settings-debug-gps').val() === 'on';
        vals.mapserverUrl = $('#settings-mapserver-url option:selected').val();
        vals.pcapiUrl = $('#settings-pcapi-url option:selected').val();

        localStorage.setItem('settings', JSON.stringify(vals, undefined, 2));
    },
}
});
