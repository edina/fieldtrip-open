"use strict";
define(['map'], function(map) {
    var run = function() {
        module("Map");
        test('point reprojection', function(){
            var wgs84 = {
                'lon': -3.18,
                'lat': 55.95
            }

            var os = {
                'lon': 326409.20,
                'lat': 673625.06
            }

            var newOs = map.pointToInternal(wgs84);
            equal(parseFloat(newOs.lon).toFixed(2), os.lon);
            equal(parseFloat(newOs.lat).toFixed(2), os.lat);

            var newWgs84 = map.pointToExternal(os);
            equal(parseFloat(newWgs84.lon).toFixed(2), wgs84.lon);
            equal(parseFloat(newWgs84.lat).toFixed(2), wgs84.lat);
        });
    };
    return {run: run}
});
