define(function() {
    'use strict';

    var WIDGET_NAME = 'warning';

    var initialize = function(index, item) {
        var $item = $(item);
        var popup = '<div data-role="popup" class="warning-popup">' +
                       '<h1>' + $item.find('label').text() + '</h1>' +
                       '<div>' +
                            '<img class="warning-icon" src="css/images/warning-icon@2x.png"/>' +
                            '<span>' + $item.find('textarea').attr('placeholder') + '</span>' +
                       '</div>' +
                       '<br />' +
                       '<a href="#" data-rel="back" data-role="button">Accept</a>' +
                    '</div>';

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
