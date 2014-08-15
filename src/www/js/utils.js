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

/* global FileError, FileTransferError */

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

/*
    Add formated data method to String
    Use: "{0} {1}".format('hello', 'world')
*/
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}

define(['settings', 'config'], function(settings, config){

    // list of UUID of devices used internally
    var priviligedUsers = [];
    if(config.priviligedUsers){
        priviligedUsers = config.priviligedUsers.split(',');
    }

    // Read the pcapiproviders and store it as an array in the config
    if(config.pcapiproviders){
        var providers = config.pcapiproviders.replace(/,+$/, '').trim();
        if(providers !== ''){
            config.pcapiProviders = providers.split(',');
        }
    }

    var userId = 'none';
    var isMobileApp = typeof(device) !== 'undefined';
    if(isMobileApp){
        userId = device.uuid;
    }

    var documentBase = window.location.pathname;
    documentBase = documentBase.replace("index.html", "");

    // setup default saved records view
    if(localStorage.getItem('records-layout') === undefined){
        if(config.savedRecordsRecordsId){
            localStorage.setItem('records-layout', 'records-list');
        }
        else{
            localStorage.setItem('records-layout', config.savedRecordsRecordsId);
        }
    }

    /**
     * @return Is this device a touch device?
     */
    var isTouchDevice = function(){
        try{
            document.createEvent("TouchEvent");
            return true;
        }
        catch(e){
            return false;
        }
    };

    /**
     * Prepend number with zeros.
     * @param number Number to fill.
     * @width The number of zeros to fill (default 2).
     */
    var zeroFill= function(number, width){
        if(width === undefined){
            width = 2;
        }

        width -= number.toString().length;
        if(width > 0){
            return new Array(width + (/\./.test( number ) ? 2 : 1) ).join('0') + number;
        }

        return number + ""; // always return a string
    };

return {

    /**
     * TODO
     */
    absoluteHeightScroller: function(selector){
        var box = $(selector);
        var padding = 100;
        var boxHeight = box.height() + padding;
        var maxHeight = $(window).height() * 0.60;//60%
        boxHeight = boxHeight < maxHeight ? boxHeight : maxHeight;
        box.css('height', boxHeight+'px');
    },

    /**
     * Append date/time to input field.
     * @param inputId Input control id.
     */
    appendDateTimeToInput: function(inputId){
        var $inputId = $(inputId);
        var prefix = $inputId.attr('value');

        if(prefix){
            $inputId.attr('value', prefix + " (" + this.getSimpleDate() + ")");
        }
    },

    /**
     * Convert number of bytes to a readable text string.
     * @param bytes
     * @return String representation of bytes.
     */
    bytesToSize: function(bytes) {
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return 'n/a';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + sizes[[i]];
    },

    /**
     * @param string
     * @return The first letter of a string uppercased.
     */
    capitaliseFirstLetter: function(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    /**
     * Clone javascript object.
     * @param obj
     * @return copy of obj.
     */
    clone: function(obj){
        return $.extend(true, {}, obj);
    },

    /**
     * Simple compare two objects function.
     * @param obj1
     * @param obj2
     * @return true if objects are the same.
     */
    compare: function(obj1, obj2){
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    },

    /**
     * @return The username and password of cloud test user.
     */
    getCloudTestUser: function(){
        return {
            name: config.testclouduser,
            pass: config.testcloudpass
        };
    },

    /**
     * @return Internet connection status.
     * {object} val - cordova connection state value, str - a textual value.
     */
    getConnectionStatus: function() {
        /* global Connection */

        var current = {
            val: -1,
            str: 'Unknown connection: Not a mobile app?'
        };
        var states = {};

        if(typeof(Connection) !== 'undefined'){
            states[Connection.UNKNOWN]  = 'Unknown connection';
            states[Connection.ETHERNET] = 'Ethernet connection';
            states[Connection.WIFI]     = 'WiFi connection';
            states[Connection.CELL_2G]  = 'Cell 2G connection';
            states[Connection.CELL_3G]  = 'Cell 3G connection';
            states[Connection.CELL_4G]  = 'Cell 4G connection';
            states[Connection.NONE]     = 'No network connection';

            current.val = navigator.connection.type;
            current.str = states[navigator.connection.type];
        }

        return current;
    },

    /**
     * @return The document base of the app.
     */
    getDocumentBase: function(){
        return documentBase;
    },

    /**
     * @param annotation Annotation record.
     * @return The editor id for a given annotation.
     */
    getEditorId: function(annotation){
        var record = annotation.record;
        return record.editor.substr(0, record.editor.indexOf('.'));
    },

    /**
     * @param error The error obj.
     * @return File error message as a string.
     */
    getFileErrorMsg: function(error){
        var msg;
        switch(error.code){
        case FileError.NOT_FOUND_ERR:
            msg = "Not Found";
            break;
        case FileError.SECURITY_ERR:
            msg = "Security Error";
            break;
        case FileError.ABORT_ERR:
            msg = "Abort Error";
            break;
        case FileError.NOT_READABLE_ERR:
            msg = "Not Readable";
            break;
        case FileError.ENCODING_ERR:
            msg = "Encoding Error";
            break;
        case FileError.NO_MODIFICATION_ALLOWED_ERR:
            msg = "No Modification Allowed";
            break;
        case FileError.INVALID_STATE_ERR:
            msg = "Invalid State";
            break;
        case FileError.SYNTAX_ERR:
            msg = "Syntax Error";
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = "Invalid Modification";
            break;
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = "Quaota Exceeded";
            break;
        case FileError.TYPE_MISMATCH_ERR:
            msg = "Type Mismatch";
            break;
        case FileError.PATH_EXISTS_ERR:
            msg = "Path Exists";
            break;
        default:
            msg = "Unknown Error: " + error.code;
        }

        return msg;
    },

    /**
     * @param dir Directory on the device.
     * @return The full path of the directory.
     */
    getFilePath: function(dir){
        if(config.noCdvFileProtocol){
            return dir.toNativeURL();
        }
        else {
            return dir.toURL();
        }
    },

    /**
     * @param error The error obj.
     * @return File error message as a string.
     */
    getFileTransferErrorMsg: function(error){
        var msg;
        switch(error.code){
        case FileTransferError.FILE_NOT_FOUND_ERR:
            msg = "File Not Found";
            break;
        case FileTransferError.INVALID_URL_ERR:
            msg = "Invalid URL";
            break;
        case FileTransferError.CONNECTION_ERR:
            msg = "Connection Error";
            break;
        case FileTransferError.ABORT_ERR:
            msg = "Abort Error";
            break;
        default:
            msg = "Unknown Error: " + error.code;
        }

        return msg;
    },

    /**
     * @param cache Is this a map cache request?
     * @return Standard parameters to map cache.
     */
    getLoggingParams: function(cache) {
        return '?version=' + this.version +
            '&id=' + userId +
            '&app=free&cache=' + cache;
    },

    /**
     * @return The map library name (openlayers or leaflet)
     */
    getMapLib: function(){
        var lib = 'openlayers';
        if(config.maplib){
            lib = config.maplib;
        }

        return lib;
    },

    /**
     * @return The field trip GB map server URL.
     */
    getMapServerUrl: function(){
        var mapserverurl = settings.get('mapserver-url');
        if(!mapserverurl){
          mapserverurl = this.getMapSettings().url;
        }
        return mapserverurl;
    },

    /**
     * @return map settings:
     *  baseLayer: fieldtrip base layer name
     *  epsg: map projection lookup
     *  layerName: map server layer name
     *  proj: map projection string
     *  type: image type
     *  url: map server URL
     *  version: map service version
     */
    getMapSettings: function(){
        return {
            'baseLayer': config.mapbaselayer,
            'epsg': config.mapepsg,
            'layerName': config.maplayername,
            'proj': config.mapproj,
            'type': config.maptype,
            'url': config.mapurl,
            'version': config.mapserviceversion
        };
    },

    /**
     * @return A location object with the autoUpdate and interval from the settings
     */
    getLocationSettings: function(){
        var location = {};
        if(settings.get('location-autoupdate') === 'on'){
            location.autoUpdate = true;
        }
        else{
            location.autoUpdate = false;
        }
        return location;
    },

    /**
     * @return Version of the pcapi.
     */
    getPCAPIVersion: function(){
        return config.pcapiversion;
    },

    /**
     * @return The field trip server web server URL.
     */
    getServerUrl: function() {
        if(isMobileApp){
            return config.webUrl;
        }
        else{
            return 'http://' + location.hostname + '/ftgb';
        }
    },

    /**
     * @return Current Date/Time in the format DD-MM-YYYY HHhMMmSSs.
     */
    getSimpleDate: function(){
        var today = new Date();
        return zeroFill(today.getDate()) + "-" +
            zeroFill(today.getMonth() + 1) + "-" +
            zeroFill(today.getFullYear()) + " " +
            zeroFill(today.getHours()) + "h" +
            zeroFill(today.getMinutes()) + "m" +
            zeroFill(today.getSeconds()) + "s";
    },

    /**
     * Go to main map page.
     * @param callback Optional callback function called on map page pageshow.
     */
    gotoMapPage: function(callback){
        if(config.recordsClickMapPage){
            $('body').pagecontainer('change', config.recordsClickMapPage);
        }
        else{
            if(callback){
                $(document).on('pageshow', '#map-page', callback);
            }
            $('body').pagecontainer('change', 'map.html');
        }
    },

    /**
     * @return Is this an android device?
     */
    isAndroid: function(){
        return isTouchDevice() && device.platform === 'Android';
    },

    /**
     * Force hide keyboard.
     */
    hideKeyboard: function(){
        if(typeof(plugins) !== 'undefined' &&
           typeof(plugins.SoftKeyBoard) !== 'undefined'){
            plugins.SoftKeyBoard.hide();
        }
    },

    /**
     * Use jquery modal loader popup for inform alert. Note: Cannot be used in
     * pageinit.
     * @param message The text to display.
     * @param duration The duration of the message in milliseconds. Default is 2
     * secs.
     */
    inform: function(message, duration, error){
        if($('.ui-loader').is(":visible")){
            if(typeof(error) !== 'undefined' && error){
                $('.ui-loader').addClass('error');
            }
            else{
                $('.ui-loader').removeClass('error');
            }

            $('.ui-loader h1').html(message);
            return;
        }

        if(duration === undefined){
            duration = 2000;
        }

        $.mobile.loading('show', {
            text: message,
            textonly: true,
        });

        setTimeout(function(){
            $.mobile.loading('hide');
        }, duration);
    },

    /**
     * Use jquery modal loader popup for error alert. Note: Cannot be used in
     * pageinit.
     * @param message The text to display.
     */
    informError: function(message){
        this.inform(message, 2000, true);
    },

    /**
     * @return Is the browser chrome?
     */
    isChrome: function(){
        if(navigator.userAgent.toLowerCase().match(/chromium/)){
            return true;
        }
        else {
            return false;
        }
    },

    /**
     * @return Is the app running on a mobile device?
     */
    isMobileDevice: function(){
        return isMobileApp;
    },

    /**
     * @return Current date in ISO 8601 format.
     * http://en.wikipedia.org/wiki/ISO_8601
     */
    isoDate: function(date){
        if(!date){
            date = new Date();
        }

        return date.getUTCFullYear() + '-' +
            zeroFill(date.getUTCMonth() + 1, 2) + '-' +
            zeroFill(date.getUTCDate(), 2) + 'T' +
            zeroFill(date.getUTCHours(), 2) + ':' +
            zeroFill(date.getUTCMinutes(), 2) + ':' +
            zeroFill(date.getUTCSeconds(), 2) + 'Z';
    },

    /**
     * @return true If user's uuid is in the list of privileged users. Desktop
     user is always a privileged user.
     */
    isPrivilegedUser: function(){
        var isPrivileged = false;
        if(isMobileApp){
            if(config.priviligedusers){
                if((config.priviligedusers.indexOf(',') != -1 &&
                    $.inArray(device.uuid, config.priviligedusers.split(',') !== -1)) ||
                   device.uuid === config.priviligedusers){
                    isPrivileged = true;
                }
            }
        }
        else{
            isPrivileged = true;
        }

        if(!isPrivileged){
            console.debug(device.uuid + " privileged user is " + isPrivileged);
        }

        return isPrivileged;
    },

    /**
     * @return true if client is ios
     */
    isIOSApp: function(){
        if(navigator.userAgent.toLowerCase().match(/iphone/) ||
           navigator.userAgent.toLowerCase().match(/ipad/)) {
            return true;
        }
        else {
            return false;
        }
    },

    /**
     * Print out javascript object as a string.
     * @param obj Javascript object.
     */
    printObj: function(obj){
        console.debug(JSON.stringify(obj, undefined, 2));
    },

    /**
     * Used for making the file system fiendly fileName.
     */
    santiseForFilename: function(text){
        var filename = text.replace(/[^-a-z0-9_\.]/gi, '_');
        return filename;
    },

    /**
     * Helper function that sets the unique value of a JQM select element.
     * @param selector Jquery selector.
     * @param value The new value.
     */
    selectVal: function(selector, value){
        $(selector).val(value).attr('selected', true).siblings('option').removeAttr('selected');
        $(selector).selectmenu("refresh", true);
    },

    /**
     * Loading dialog with different text.
     * @param message The text to display.
     */
    showPageLoadingMsg: function(message){
        $.mobile.loading('show', {text: message});
    },

    /**
     * @return Should end user license / splash be shown?
     */
    showStartPopup: function(){
        if(config.endUserLicence && !this.isPrivilegedUser()){
            return true;
        }
        else{
            return false;
        }
    },

    /**
     * Helper function that sets the value of a JQM slider on/off element.
     * @param selector Jquery selector.
     * @param value 'on' or 'off'.
     */
    flipswitchVal: function(selector, value){
        $(selector).val(value);
        $(selector).flipswitch('refresh');
    },

    /**
     * @return whether the device support HTML5 canvas and toDataURL?
     */
    supportsToDataURL: function (){
        var support = false;

        if(document.createElement('canvas').getContext !== undefined)
        {
            var c = document.createElement("canvas");
            var data = c.toDataURL("image/png");
            support = data.indexOf("data:image/png") === 0;
        }

        return support;
    },

    /**
     * @return String as a boolean value.
     */
    str2bool: function(val){
        var bool = false;
        if(val){
            bool = val.toLowerCase() === 'true';
        }
        return bool;
    },

    /**
     * Android workaround for overflow: auto support. Only applicable to android 2 and doesn't work for embedded divs, e.g the records page. See http://chris-barr.com/index.php/entry/scrolling_a_overflowauto_element_on_a_touch_screen_device/
     */
    touchScroll: function(selector) {
        if(this.isAndroid()){
            var version = device.version.replace(".", "").substr(0, 2);
            if(version > 23){
                return;
            }

            var scrollStartPosY = 0;
            var scrollStartPosX = 0;

            $('body').delegate(selector, 'touchstart', function(e) {
                scrollStartPosY = this.scrollTop + e.originalEvent.touches[0].pageY;
                scrollStartPosX = this.scrollLeft + e.originalEvent.touches[0].pageX;
            });

            $('body').delegate(selector, 'touchmove', function(e) {
                if ((this.scrollTop < this.scrollHeight - this.offsetHeight &&
                     this.scrollTop + e.originalEvent.touches[0].pageY < scrollStartPosY-5) ||
                    (this.scrollTop !== 0 && this.scrollTop+e.originalEvent.touches[0].pageY > scrollStartPosY+5)){
                    e.preventDefault();
                }
                if ((this.scrollLeft < this.scrollWidth - this.offsetWidth &&
                     this.scrollLeft+e.originalEvent.touches[0].pageX < scrollStartPosX-5) ||
                    (this.scrollLeft !== 0 && this.scrollLeft+e.originalEvent.touches[0].pageX > scrollStartPosX+5)){
                    e.preventDefault();
                }


                this.scrollTop = scrollStartPosY - e.originalEvent.touches[0].pageY;
                this.scrollLeft = scrollStartPosX - e.originalEvent.touches[0].pageX;
            });
        }
    },

    /**
     * App version.
     */
    version: config.version
};

});
