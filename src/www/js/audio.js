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

/* jshint multistr: true */
/* global Media */


/**
 * Fieldtrip js audio player module.
 */
define(function(){

    // current/last played audio
    var currentAudio;

    /**
     * Audio media class.
     * @param src The media file.
     */
    var init = function(src){
        // Create Media object from src
        _this.audio = new Media(
            src,
            onSuccess,
            onError
        );

        _this.audio.status = Media.MEDIA_NONE;
    };

    /**
     * Clear audio track.
     */
    var clear = function(){
        clearInterval(_this.audioTimer);
        _this.audioTimer = null;

        $('#annotate-audio-position').text('0.0');

        $('#annotate-audio-button').addClass('annotate-audio-stopped');
        $('#annotate-audio-button').removeClass('annotate-audio-started');
    };

    /**
     * Release audio resources.
     */
    var destroy = function(){
        if(_this.audio){
            _this.audio.release();
        }
    };

    /**
     * Error playing audio track.
     */
    var onError = function(error){
        navigator.notification.alert('code: '    + error.code    + '\n' +
                                     'message: ' + error.message + '\n');
    };

    /**
     * Audio track has successfully played.
     */
    var onSuccess = function(success){
        clear();
    };

    /**
     * Pause audio track.
     */
    var pause = function(){
        if(_this.audio){
            _this.audio.pause();
        }
    };

    /**
     * Play audio track.
     */
    var play = function() {
        _this.audio.play();

        $('#annotate-audio-button').removeClass('annotate-audio-stopped');
        $('#annotate-audio-button').addClass('annotate-audio-started');

        _this.audioTimer = setInterval(function(){
            _this.audio.getCurrentPosition(
                function(position) {
                    if(position > -1) {
                        $('#annotate-audio-position').text(position.toFixed(1));
                    }
                },
                // error callback
                function(e) {
                    console.error("Error getting pos=" + e);
                }
            );
        }, 100);
    };

    /**
     * Stop audio track.
     */
    var stop = function(){
        if(_this.audio){
            _this.audio.stop();
        }

        clear();
    };

var _this = {

    /**
     * Generate play audio node.
     * @param url Audio file URL.
     * @param label Optional text label.
     */
    getNode: function(url, options){
        var label = options.label || '';
        var durationms = options.duration || 0;
        var duration = durationms / 1000;

        var html = '<div class="annotate-audio-taken">';
        html += '<span>' + label + '</span>';
        html += '<input type="hidden" value="' + url + '"/>';
        html += '<a id="annotate-audio-button" class="annotate-audio-stopped" data-theme="a" data-iconpos="notext" href="#" data-role="button" ></a><br />';
        html += '<span id="annotate-audio-position">0.0</span>';
        if(duration){
          html += '<span>/' + duration + '</span>';
        }
        html += '<span>&nbsp;seconds</span>';
        html += '</div>';
        return html;
    },

    /**
     * Play audio track.
     */
    playAudio: function(){
        var url = $('.annotate-audio-taken input').attr('value');

        if(this.audio){
            if(this.audio.src !== url){
                destroy();
                init(url);
            }
        }
        else{
            init(url);
        }

        if(this.audio.status === Media.MEDIA_RUNNING ||
           this.audio.status === Media.MEDIA_STARTING){
            stop();
        }
        else{
            play();
        }
    }
};

return _this;

});
