"use strict";
define(['map'], function(map) {
    var run = function() {
        test('Map: do something.', function() {
            equal(2, 2, 'The return should be 2.');
        });
    };
    return {run: run}
});