/*
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
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

define(function(require, exports) {
    'use strict';
    var warningWidget = require('widgets/warning');

    var widgetsRegister = {};

    /**
     * Register a new widget
     * @param widget
     */
    var registerWidget = function(widget) {
        var name = widget.name;

        if (!widgetsRegister.hasOwnProperty(name)) {
            widgetsRegister[name] = [];
        }
        widgetsRegister[name].push(widget);
    };

    /**
     * Get the list of widgets registered with that type
     * @param widgetType
     * @return Array of widgets
     */
    var getWidgets = function(widgetType) {
        var widgets = [];
        if (widgetsRegister.hasOwnProperty(widgetType)) {
            widgets = widgetsRegister[widgetType];
        }

        return widgets;
    };

    /**
     * Invoke the initialize function of an Array of widgets
     * @param widgets
     */
    var initializeWidgets = function(widgets) {
        var args = Array.prototype.slice.call(arguments, 1);

        for (var i = 0, len = widgets.length; i < len; i++) {
            widgets[i].initialize.apply(null, args);
        }
    };

    /**
     * Invoke the deserialize function of an Array of widgets
     * @param widgets
     * @return the value of merging the calls, null if no serialize is implemented
     */
    var deserializeWidgets = function(widgets) {
        var args = Array.prototype.slice.call(arguments, 1);

        for (var i = 0, len = widgets.length; i < len; i++) {
            widgets[i].deserialize.apply(null, args);
        }
    };

    /**
     * Invoke the serialize function of an Array of widgets
     * @param widgets
     * @return the value of merging the calls, null if no serialize is implemented
     */
    var serializeWidgets = function(widgets) {
        var args = Array.prototype.slice.call(arguments, 1);
        var result;
        var value, repr;
        var valueWithError;
        var values = [];
        var i, len;

        for (i = 0, len = widgets.length; i < len; i++) {
            valueWithError = widgets[i].serialize.apply(null, args);
            if (valueWithError.serialize === true) {
                values.push(valueWithError);
            }
        }

        switch (values.length) {
            case 0:
                result = null;
            break;
            case 1:
                result = {
                    value: values[0].value,
                    repr: values[0].repr,
                    label: values[0].label
                };
            break;
            default:
                //TODO: Maybe several behaviours of a single widget shouldn't
                //      be supported

                value = {};
                repr = '';
                label = '';
                for (i = 0, len = values.length; i < len; i++) {
                    $.extend(value, values[i].value);
                    repr += values[i].repr;
                    label = values[i].label;
                }

                result = {
                    value: value,
                    repr: repr,
                    label: label
                };
        }

        return result;
    };

    // Register default widgets
    registerWidget(warningWidget);

    // Public interface
    return {
        registerWidget: registerWidget,
        getWidgets: getWidgets,
        initializeWidgets: initializeWidgets,
        serializeWidgets: serializeWidgets,
        deserializeWidgets: deserializeWidgets
    };

});
