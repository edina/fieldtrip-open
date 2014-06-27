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
 * Fieldtrip settings module.
 */
define(['config'], function(config){
    var vals;

    /**
     * For a given setting entry, save control value.
     * @param i The index id of the control.
     * param div The HTML div
     */
    var getControlValue = function(i, div){
        var id = $(div).attr('id').split('settings-')[1];
        var control = $(div);

        if(typeof(control) !== 'undefined'){
            var tag = control.prop('tagName').toLowerCase();
            if(control.attr('data-role') === 'slider'){
                // a slider is a select tag but
                // can be identified by its data-role
                tag = 'slider';
            }

            vals[id] = {
                'type': tag,
                'val': $(control).val()
            }
        }
        else{
            vals[id] = undefined;
        }
    };

    /**
     * Save current settings to localstorage.
     */
    var save = function(){
        $.each($('[name=settings-entry]'), getControlValue);
        localStorage.setItem('settings', JSON.stringify(vals, undefined, 2));
    };

    /**
     * Open settings page.
     */
    var settingsPage = function(){

        $('.ui-title').text('Settings');
        require(['utils'], function(utils){
            $.each(vals, function(name, entry){
                var id = '#settings-' + name;
                if(typeof(entry) !== 'undefined'){
                    if(entry.type === 'select'){
                        utils.selectVal(id, vals[name].val);
                    }
                    else if(entry.type === 'slider'){
                        utils.sliderVal(id, vals[name].val);
                    }
                    else{
                        $(id).val(vals[name].val);
                    }
                }
            });

            $('#settings-clear-local-storage a').click(function(){
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

    var stored = localStorage.getItem('settings');
    if(stored){
        vals = JSON.parse(stored);
    }
    else{
        vals = {};

        // initialise based on default values
        $.get('../settings.html', function(data){
            $.each($(data).find('[name=settings-entry]'), getControlValue);
        });
    }

    // ensure map has URL defined
    if(vals['mapserver-url'] === undefined){
        vals['mapserver-url'] = config.map_url;
    }

    $(document).on('pageinit', '#settings-page', settingsPage);
    $(document).on('pageremove', '#settings-page', save);

return{

    /**
     * Get setting for named value.
     * @param name The name of the setting.
     */
    get: function(name){
        var val;
        if(vals[name]){
            val = vals[name].val;
        }
        return val;
    }
}

});
