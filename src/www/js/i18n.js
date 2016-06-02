'use strict';

define(function(require) {
    var i18next = require('ext/i18next');
    var i18nextJquery = require('ext/jquery-i18next');
    var i18nextXHRbackend = require('ext/i18next-xhr-backend');
    var catalogText = require('text!../locales/catalog.json');
    var catalog = JSON.parse(catalogText);

    i18next
        .use(i18nextXHRbackend)
        .init({
            debug: false,
            lng: 'en',
            preload: catalog.languages,
            lngs: catalog.languages,
            fallbackLng: 'en',
            ns: catalog.namespaces,
            defaultNS: 'index',
            fallbackNS: 'common',
            backend: {
                loadPath: 'locales/{{lng}}/{{ns}}.json'
            }
        }, function(err, t) {
            var userLng = localStorage.getItem('user-language');

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

            i18next.changeLanguage(userLng);
            $(document).localize();
        });
});
