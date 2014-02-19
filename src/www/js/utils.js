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

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};


define(['settings'], function(settings){

    /******** private ***********************/

    // list of UUID of devices used internally
    var PRIVILIGED_USERS = [
    ];

    var userId = 'none';
    var isMobileApp = typeof(device) !== 'undefined';
    if(isMobileApp){
        userId = device.uuid;
    }

    var documentBase = window.location.pathname;
    documentBase =documentBase.replace("index.html", "");

    /**
     * Get application root directory.
     * @param callback Function executed after root has been retrieved.
     * @param type LocalFileSystem.PERSISTENT or LocalFileSystem.TEMPORARY
     */
    var getFileSystemRoot = function(callback, type){
        window.requestFileSystem(
            type,
            0,
            function(fileSystem){
                fileSystem.root.getDirectory(
                    _this.getRootDir(),
                    {create: true, exclusive: false},
                    function(dir){
                        callback(dir);
                    },
                    function(error){
                        alert('Failed to get file system:' + error);
                    });
            },
            function(error){
                alert('Failed to get file system:' + error);
            });
    };

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
     * @width The number of zeors to fill.
     */
    var zeroFill= function(number, width){
        width -= number.toString().length;
        if(width > 0){
            return new Array(width + (/\./.test( number ) ? 2 : 1) ).join('0') + number;
        }

        return number + ""; // always return a string
    };

var _base = {

    /*********** public ***********************/

    /**
     * TODO
     */
    absoluteHeightScroller: function(selector){
        var box = $(selector);
        var padding = 100;
        var boxHeight = box.height() + padding;
        var maxHeight = $(window).height() * 0.60;//60%
        var boxHeight = boxHeight < maxHeight ? boxHeight : maxHeight  ;
        box.css('height', boxHeight+'px');
    },

    /**
     * TODO
     */
    appendDateTimeToInput: function(inputId){
        var $inputId = $(inputId);
        var prefix = $inputId.attr('value');

        if(prefix){
            $inputId.attr('value', prefix + this.getSimpleDate());
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
     * Confirm yes/no dialogue helper.
     * @param title Confirm dialogue title.
     * @param test The text content.
     * @param object The object to envoke when ok is applied.
     * @param func The function to execute when ok is applied.
     * @param args The arguments to the above function.
     */
    confirm: function(title, text, object, func, args){
        $(document).off('pageinit', '#confirm-page');
        $(document).on('pageinit', '#confirm-page', function(event){
            $('#confirm-page-header h1').text(title);
            $('#confirm-page-content h1').text(title);
            $('#confirm-page-content p').text(text);

            $('#confirm-ok').unbind('click');
            $('#confirm-ok').click(function(){
                func.apply(object, args);
            });
        });

        $.mobile.changePage('confirm.html', {role: "dialog"});
    },

    /**
     * @return Internet connection status.
     * {object} val - cordova connection state value, str - a textual value.
     */
    getConnectionStatus: function() {
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

            current['val'] = navigator.connection.type;
            current['str'] = states[navigator.connection.type];
        }

        return current;
    },

    /**
     * TODO
     */
    getDocumentBase : function (){
        return documentBase;
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
     * @return The field trip GB map server URL.
     */
    getMapServerUrl: function() {
        if(isMobileApp){
            return settings.getMapServerUrl();
        }
        else{
            var url = 'http://' + location.hostname;

            if(location.port){
                url += ':' + location.port
            }

            return url += '/'+settings.getBaseLayerName();
        }
    },

    /**
     * Get permanent root directory
     * @param callback function to be executed when persistent root is found
     * @return Persistent file system.
     */
    getPersistentRoot: function(callback){
        return getFileSystemRoot(callback, LocalFileSystem.PERSISTENT);
    },

    /**
     *
     */
    getRootDir: function(){
        return "edina"
    },

    /**
     * @return The field trip GB server web server URL. This is currently the
     * pcapi URL in settings.
     */
    getServerUrl: function() {
        if(isMobileApp){
            return settings.getPcapiUrl();
        }
        else{
            return 'http://' + location.hostname + '/ftgb';
        }

    },

    /**
     * TODO
     */
    getSimpleDate: function(){

        var today = new Date();
        var h = today.getHours();
        var m = today.getMinutes();
        var dd = today.getDate();
        var mm = today.getMonth()+1;
        var s = today.getSeconds() //January is 0!

        var yyyy = today.getFullYear();
        if(dd<10){dd='0'+dd} if(mm<10){mm='0'+mm} if(h<10){h='0'+h} if(m<10){m='0'+m} if(s<10){s='0'+s} today = ' ('+ dd+'-'+mm+'-'+yyyy+' '+h+'h'+m+'m'+s+'s)';
        return today;
    },

    /**
     * Get temporary root directory, this is secure and deleted if application is
     * uninstalled.
     * @param callback The function to be called when filesystem is retrieved.
     * @return Temporary file system.
     */
    getTemporaryRoot: function(callback){
        return getFileSystemRoot(callback, LocalFileSystem.TEMPORARY);
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
            date= new Date();
        }

        return date.getUTCFullYear() + '-' +
            zeroFill(date.getUTCMonth() + 1, 2) + '-' +
            zeroFill(date.getUTCDate(), 2) + 'T' +
            zeroFill(date.getUTCHours(), 2) + ':' +
            zeroFill(date.getUTCMinutes(), 2) + ':' +
            zeroFill(date.getUTCSeconds(), 2) + 'Z';
    },

    /**
     * @return true If user's uuid is in the list of privileged users.
     */
    isPrivilegedUser: function(){

        if(isMobileApp && $.inArray(device.uuid, PRIVILIGED_USERS) === -1){
            return false;
        }
        else{
            return true;
        }
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
            $.mobile.hidePageLoadingMsg();
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
     * Print out javascript object as a string.
     * @param obj Javascript object.
     */
    printObj: function(obj){
        console.debug(JSON.stringify(obj, undefined, 2));
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
     * Helper function that sets the value of a JQM slider on/off element.
     * @param selector Jquery selector.
     * @param value true or false.
     */
    sliderVal: function(selector, value){
        $(selector).val(value ? 'on' : 'off');
        $(selector).slider('refresh');
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
     * Used for making the file system fiendly fileName.
     */
    santiseForFilename: function(text){
        var filename = text.replace(/[^-a-z0-9_\.]/gi, '_');
        return filename;
    },

    /**
     * Android workaround for overflow: auto support. See http://chris-barr.com/index.php/entry/scrolling_a_overflowauto_element_on_a_touch_screen_device/
     */
    touchScroll: function(selector) {
        if(isTouchDevice()){
            var scrollStartPosY = 0;
            var scrollStartPosX = 0;

            $('body').delegate(selector, 'touchstart', function(e) {
                scrollStartPosY = this.scrollTop + e.originalEvent.touches[0].pageY;
                scrollStartPosX = this.scrollLeft + e.originalEvent.touches[0].pageX;
            });

            $('body').delegate(selector, 'touchmove', function(e) {
                if ((this.scrollTop < this.scrollHeight - this.offsetHeight &&
                     this.scrollTop + e.originalEvent.touches[0].pageY < scrollStartPosY-5) ||
                    (this.scrollTop != 0 && this.scrollTop+e.originalEvent.touches[0].pageY > scrollStartPosY+5)){
                    e.preventDefault();
                }
                if ((this.scrollLeft < this.scrollWidth - this.offsetWidth &&
                     this.scrollLeft+e.originalEvent.touches[0].pageX < scrollStartPosX-5) ||
                    (this.scrollLeft != 0 && this.scrollLeft+e.originalEvent.touches[0].pageX > scrollStartPosX+5)){
                    e.preventDefault();
                }


                this.scrollTop = scrollStartPosY - e.originalEvent.touches[0].pageY;
                this.scrollLeft = scrollStartPosX - e.originalEvent.touches[0].pageX;
            });
        }
    },

    /**
     * App version, updated by fab, do not edit.
     */
    'version': '1.4.0.0'

}

var _this = {};
var _android = {
    /**
     * TODO
     */
    getRootDir: function(){
        return "Android/data/uk.ac.edina.mobile";
    }
};

if(_base.isIOSApp()){
    _this = _base;
}
else{
    $.extend(_this, _base, _android);
}

return _this;

});

// function initHomepageDisplay(){
//     //private
//     var FIELDTRIPGB_NEWS_FEED_URL = Utils.getServerUrl() + "/splash.html";


//     //public
//     return {
//         hideSyncAndShowLogin: function(){
//             $('#home-content-sync').hide();
//             $('#home-content-upload').hide();


//             //Bug 5997 have to use full url due to jqm issue
//             $('#home-content-login img').attr('src',  Utils.getDocumentBase() + 'css/images/login-large.png');
//             $('#home-content-login p').text('Login');
//         },

//         showLogoutAndSync: function(){

//             //Bug 5997 have to use full url due to jqm issue
//             $('#home-content-login img').attr('src',  Utils.getDocumentBase() + 'css/images/logout.png');
//             $('#home-content-login p').text('Logout');

//             //show sync button
//             $('#home-content-sync').show();
//             $('#home-content-upload').show();
//         },
//         getNewsFeed: function(selector){

//             $.ajax({url:FIELDTRIPGB_NEWS_FEED_URL, success:function(result) {
//                 if (result) {
//                    $(selector).html(result);
//                 };
//             }, cache: false});

//         }

//     };
// };
