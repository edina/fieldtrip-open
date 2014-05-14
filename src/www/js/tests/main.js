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

define(['QUnit', 'tests/systests'], function(QUnit, systests){
    var pageId;
    var testsPreviouslyRun = true;
    var sysTestsRunning = false;

    var init = function(){
        $('#qunit-testrunner-toolbar').hide();
        if($('link[href="../css/ext/qunit.css"]').length === 0){
            $("<link/>", {
                rel: "stylesheet",
                type: "text/css",
                href: "../css/ext/qunit.css"
            }).appendTo("head");

            QUnit.load();
        }
    };

   var cleanTestPage = function(){
        // this is deprecated but its not clear sure how to do this otherwise
        QUnit.reset();
        $('#qunit-tests').empty();
        $('#qunit-testresult').empty();
    };

    var isUnitTest = function(){
        return pageId === 'home-unit-test-but';
    };

    /**
     * Load Unit tests.
     */
    var sysTestPage = function(){
        $('#test-page-sys').show();
        if(!sysTestsRunning){
            cleanTestPage();

            $.each(systests.tests, function(name, test){
                var method = 'jings';
                //$('#qunit-tests-list').append('<li data-autodividers="true">' + name + '</li>')
                //$('#qunit-tests-list').append('<li><a href="#" class="qunit-single-test" test="' + name + '">' + name + '</a></li>');

            });
        }


        $('#qunit-tests-list').listview('refresh');

        $('#test-page-runall').unbind();
        $('#test-page-runall').on('click', function(){
            cleanTestPage();
            sysTestsRunning = true;
            //
            QUnit.init();
            QUnit.start();
            systests.run();
        });

        $('#test-page-restart').unbind();
        $('#test-page-restart').on('click', function(){
            //cleanTestPage();
            //initTests(options);
        });

        $('.qunit-single-test').unbind();
        $('.qunit-single-test').on('click', function(){
            // runSingleTest($(this).attr('test'),
            //               $(this).attr('method'));
        });

        // run plugin tests
        // $.getJSON('theme/project.json', function(f){
        //     var fieldtrip = f.plugins.fieldtrip;
        //     var noOfPlugins = Object.keys(fieldtrip).length;

        //     if(noOfPlugins > 0){
        //         var loaded = 0;
        //         $.each(fieldtrip, function(name){
        //             require(["plugins/" + name + "/js/" + fileName], function(tests){
        //                 console.debug(name + " tests loaded");
        //                 if(tests){
        //                     tests.run();
        //                 }

        //                 ++loaded;

        //                 if(loaded === noOfPlugins){
        //                     pluginsLoaded();
        //                 }
        //             });
        //         });
        //     }
        //     else{
        //         pluginsLoaded();
        //     }
        // });
    };

    /**
     * Load Unit tests.
     */
    var unitTestPage = function(){
        $('#test-page-sys').hide();
        cleanTestPage();

        require(['tests/records', 'tests/map'], function(records, map) {
            // run the core tests.
            records.run();
            map.run();

            // run plugin tests
            $.getJSON('theme/project.json', function(f){
                var fieldtrip = f.plugins.fieldtrip;
                var noOfPlugins = Object.keys(fieldtrip).length;
                if(noOfPlugins > 0){
                    $.each(fieldtrip, function(name){
                        require(["plugins/" + name + "/js/tests.js"], function(tests){
                            if(tests){
                                tests.run();
                            }
                        });
                    });
                }
            });
        });
    };

    var testPage = function(e){
        init();
        if(isUnitTest()){
            unitTestPage();
        }
        else{
            sysTestPage();
        }
    };

    QUnit.done(function(e){
        if(!isUnitTest()){
            systests.goToTestPage(function(){
                sysTestsRunning = false;
            });
        }
    });

    $(document).on('vclick', '.test-page-but', function(e){
        pageId = $(e.target).parent().parent().attr('id');
        $.mobile.changePage('#test-page');
    });
    $(document).on('pageshow', '#test-page', testPage);
});
