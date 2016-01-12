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

'use strict';

define(function(require) {
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
            value: null,
            repr: null
        };
    };

    return {
        name: WIDGET_NAME,
        initialize: initialize,
        validate: validate,
        serialize: serialize
    };

});
