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

/* global OpenLayers */

/**
 * Fieldtrip settings module.
 */
define(function(){
    var vals;

    /**
     * For a given setting entry, save control value.
     * @param i The index id of the control.
     * param div The HTML div
     */
    var getControlValue = function(i, div){
        var id = $(div).attr('id').split('settings-')[1];
        var $control = $(div);

        if(typeof($control) !== 'undefined'){
            var tag = $control.prop('tagName').toLowerCase();
            var values = [];
            if(tag === 'select'){
                $.each($control.find('option'), function(i, el){
                    values.push(el.value);
                });
            }

            if($control.attr('data-role') === 'flipswitch'){
                // a slider is a select tag but
                // can be identified by its data-role
                tag = 'flipswitch';
            }

            vals[id] = {
                'type': tag,
                'values': values,
                'val': $control.val()
            };
        }
        else{
            vals[id] = undefined;
        }
    };

    vals = {};
    $.get('settings.html', function(data){
        // Load the actual values into vals
        $.each($(data).find('[name=settings-entry]'), getControlValue);

        // Get the stored settings string
        var storedStr = localStorage.getItem('settings');
        if(storedStr){
            var stored = JSON.parse(storedStr);

            for(var key in stored){
                var value = vals[key];
                // if the value exist in the setting values check for its validity
                if(value !== undefined){
                    var valids = vals[key].values;

                    // Use the value if it's valid
                    if(valids && valids.indexOf(stored[key].val) >= 0){
                        vals[key].val = stored[key].val;
                    }
                }
            }
        }

        // Store the settings
        localStorage.setItem('settings', JSON.stringify(vals, undefined, 2));
    });

    /************************** public interface  ******************************/

return{

    /**
     * Initialise settings page.
     */
    init: function(){
        var devClickCount = 0;
        require(['utils'], function(utils){
            $('#settings-project').text(utils.version);
            $('#settings-jquery').text($().jquery);
            $('#settings-jqm').text(jQuery.mobile.version);

            if(typeof(OpenLayers) !== "undefined"){
                $('#settings-ol').text(OpenLayers.VERSION_NUMBER);
            }

            if(utils.isMobileDevice()){
                $('#settings-cordova').text(device.cordova);
            }
            else{
                $('#settings-cordova').text('n/a');
            }

            $(document).on('vclick', '#settings-project', function(){
                if(++devClickCount >= 10){
                    var devMode = ! JSON.parse(localStorage.getItem('devMode'));
                    if(devMode){
                        console.debug('Developer mode activated');
                    }else{
                        console.debug('Developer mode deactivated');
                    }
                    localStorage.setItem('devMode', devMode);
                    devClickCount = 0;
                }
            });

            $.each(vals, function(name, entry){
                var id = '#settings-' + name;
                if(typeof(entry) !== 'undefined'){
                    if(entry.type === 'select'){
                        utils.selectVal(id, vals[name].val);
                    }
                    else if(entry.type === 'flipswitch'){
                        utils.flipswitchVal(id, vals[name].val);
                    }
                    else{
                        $(id).val(vals[name].val);
                    }
                    $(id).trigger('change');
                }
            });
        });
    },

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
    },

    /**
     * Save current settings to localstorage.
     */
    save: function(){
        $.each($('[name=settings-entry]'), getControlValue);
        localStorage.setItem('settings', JSON.stringify(vals, undefined, 2));
    }
};

});
