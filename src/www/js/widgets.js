define(function(require, exports) {
    'use strict';
    var geometryTypeWidget = require('widgets/geometryType-widget');
    var warningWidget = require('widgets/warning-widget');

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
        var value;
        var valueWithError;
        var values = [];
        var i, len;

        for (i = 0, len = widgets.length; i < len; i++) {
            valueWithError = widgets[i].serialize.apply(null, args);
            if (valueWithError.serialize === true) {
                values.push(valueWithError.value);
            }
        }

        switch (values.length) {
            case 0:
                value = null;
            break;
            case 1:
                value = values[0];
            break;
            default:
                value = {};
                for (i = 0, len = values.length; i < len; i++) {
                    $.extend(value, values[i]);
                }
        }

        return value;
    };

    // Register default widgets
    registerWidget(warningWidget);
    registerWidget(geometryTypeWidget);

    // Public interface
    return {
        registerWidget: registerWidget,
        getWidgets: getWidgets,
        initializeWidgets: initializeWidgets,
        serializeWidgets: serializeWidgets
    };

});
