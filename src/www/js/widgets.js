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
                    repr: values[0].repr
                };
            break;
            default:
                value = {};
                repr = '';
                for (i = 0, len = values.length; i < len; i++) {
                    $.extend(value, values[i].value);
                    repr += values[i].repr;
                }

                result = {
                    value: value,
                    repr: repr
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
        serializeWidgets: serializeWidgets
    };

});
