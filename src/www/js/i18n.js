'use strict';

define(function(require) {
    var i18next = require('ext/i18next');
    var i18nextJquery = require('ext/jquery-i18next');
    var i18nextXHRbackend = require('ext/i18next-xhr-backend');

    i18next
        .use(i18nextXHRbackend)
        .init({
            debug: true,
            lng: 'es',
            fallbackLng: 'en',
            ns: [
                'index',
                'map',
                'footer'
            ],
            defaultNS: 'index',
            fallbackNS: 'common',
            backend: {
                loadPath: 'locales/{{lng}}/{{ns}}.json'
            }
        }, function(err, t) {
            i18nextJquery.init(i18next, $, {
                tName: 't',
                i18nName: 'i18n',
                handleName: 'localize',
                selectorAttr: 'data-i18n',
                targetAttr: 'data-i18n-target',
                optionsAttr: 'data-i18n-options',
                useOptionsAttr: false,
                parseDefaultValueFromContent: true
            });

            $(document).on('pagecreate', function(event, ui) {
                $(event.target).localize();
            });

            $(document).localize();
        });
});
