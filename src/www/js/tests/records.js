"use strict";
define(['records'], function(records) {
    var run = function() {
        test('Records: do something sensible', function() {
            equal(2, 2, 'The return should be 2.');
        });
    };
    return {run: run}
});
