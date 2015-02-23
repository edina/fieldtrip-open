define(function() {
    'use strict';
    var _ = require('underscore');

    var WIDGET_NAME = 'warning';

    var popupTpl = _.template(
        '<div data-role="popup" class="warning-popup">' +
            '<h1><%- title %></h1>' +
                '<div>' +
                    '<img class="warning-icon" src="css/images/warning-icon@2x.png"/>' +
                    '<span><%- text %></span>' +
                '</div>' +
                '<br />' +
                '<a href="#" data-rel="back" data-role="button">Accept</a>' +
        '</div>'
    );

    var initialize = function(index, item) {
        var $item = $(item);
        var popup = popupTpl({
            title: $item.find('label').text(),
            text: $item.find('textarea').attr('placeholder')
        });

        $item.closest('form').append(popup);
        $item.hide();
    };

    var validate = function(html) {
        return {
            valid: true,
            errors: []
        };
    };

    var serialize = function(html) {
        return {
            serialize: false,
            value: null
        };
    };

    return {
        name: WIDGET_NAME,
        initialize: initialize,
        validate: validate,
        serialize: serialize
    };

});
