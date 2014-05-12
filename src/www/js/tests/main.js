/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
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

"use strict";

define(['QUnit', 'tests/records', 'tests/map'], function(QUnit, records, map){
    /**
     * Load Unit tests.
     */
    var unitTestPage = function(){
        if($('link[href="../css/ext/qunit.css"]').length === 0){
            $("<link/>", {
                rel: "stylesheet",
                type: "text/css",
                href: "../css/ext/qunit.css"
            }).appendTo("head");
        }

        var previouslyRun = false;
        if($('#qunit-tests li').length > 0){
            $('#qunit-tests').empty();
            previouslyRun = true;
        }

        var pluginsLoaded = function(){
            if(!previouslyRun){
                // start QUnit.
                QUnit.load();
                QUnit.start();

            }
        };

        // run the core tests.
        records.run();
        map.run();

        // run plugin tests
        $.getJSON('theme/project.json', function(f){
            var fieldtrip = f.plugins.fieldtrip;
            var noOfPlugins = Object.keys(fieldtrip).length;

            if(noOfPlugins > 0){
                var loaded = 0;
                $.each(fieldtrip, function(name){
                    require(["plugins/" + name + "/js/tests.js"], function(tests){
                        console.debug(name + " tests loaded");
                        tests.run();
                        ++loaded;

                        if(loaded === noOfPlugins){
                            pluginsLoaded();
                        }
                    });
                });
            }
            else{
                pluginsLoaded();
            }
        });
    };

    $(document).on('pageshow', '#unit-test-page', unitTestPage);
});

