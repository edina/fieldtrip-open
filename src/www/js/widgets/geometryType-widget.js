/**
Polygon Widget
==============

Overview:
This widget will open a map where a polygon feature can be selected

Markup:

```html
    <div data-role="controlgroup" data-type="vertical" class="map-control-buttons">
      <a href="#" data-role="button" data-icon="capture-point" data-iconpos="notext">Point</a>
      <a href="#" data-role="button" data-icon="capture-line" data-iconpos="notext">Line</a>
      <a href="#" data-role="button" data-icon="capture-polygon" data-iconpos="notext">Polygon</a>
      <a href="#" data-role="button" data-icon="capture-box" data-iconpos="notext">Box</a>
    </div>
```
*/

define(function(require, exports) {
    'use strict';
    var _ = require('underscore');

    var WIDGET_NAME = 'geometryType';

    var polygonWidgetTpl = _.template(
        '<a href="#" data-role="button" data-icon="capture-<%= geometry %>" data-iconpos="notext"><%= geometry %></a>'
    );

    var initialize = function(elements, item) {
        if(elements.length > 1){
            var $item = $(item);
            var html = [];
            html.push('<div data-role="controlgroup" data-type="vertical" class="map-control-buttons">');

            for(var i=0; i<elements.length; i++){
                html.push(polygonWidgetTpl({
                    geometry: elements[i]
                }));
            }
            html.push('</div>');

            $item.append(html.join(""));
            $item.trigger('create');
        }
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
