/**
Polygon Widget
==============

Overview:
This widget will open a map where a polygon feature can be selected

Markup:

```html
    <div class="fieldcontain" id="fieldcontain-polygon-1" data-cobweb-type="polygon">
        <input name="form-polygon-1" id="form-polygon-1" required="">
        <label for="form-polygon-1">Polygon</label>
    </div>
```
*/

define(function(require, exports) {
    'use strict';
    var _ = require('underscore');
    //var map = require('map'); < circular dependency problem

    var WIDGET_NAME = 'polygon';

    var polygonWidgetTpl = _.template(
        '<div id="annotate-polygon-<%= index %>">' +
            '<a class="annotate-polygon" href="#">' +
                '<img src="css/images/capture-polygon.png">' +
            '</a>' +
        '</div>'
    );

    var initialize = function(index, item) {
        var $item = $(item);

        var html = polygonWidgetTpl({
            index: index
        });

        $item.find('input').hide();
        $item.append(html);

        $item.find('a.annotate-polygon').on('vclick', function(evt) {
            // TODO: @rgamez open the map and capture the value on close
            console.debug('click');

        });
    };

    var validate = function(html) {
        // TODO: @rgamez
        return {
            valid: true,
            errors: []
        };
    };

    var serialize = function(html) {
        // TODO: @rgamez
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
