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

define(function(){

  // Attach the play function to the audio button
  $(document).off('vclick', '#annotate-audio-button');
  $(document).on('vclick', '#annotate-audio-button', function(event) {
    playAudio();
  });

return{

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
};

});

// TODO migrate below to requirejs syntax

// current/last played audio
var currentAudio;

/**
 * Play audio track.
 */
function playAudio(){
    var url = $('.annotate-audio-taken input').attr('value');

    if(currentAudio){
        if(currentAudio.src !== url){
            currentAudio.destroy();
            currentAudio = new Audio(url);
        }
    }
    else{
        currentAudio = new Audio(url);
    }

    if(currentAudio.status === Media.MEDIA_RUNNING ||
       currentAudio.status === Media.MEDIA_STARTING){
        currentAudio.stop();
    }
    else{
        currentAudio.play();
    }
}

/**
 * Audio media class.
 * @param src The media file.
 */
function Audio(src){
    // Create Media object from src
    this.src = src;
    this.media = new Media(src,
                           $.proxy(this.onSuccess, this),
                           $.proxy(this.onError, this),
                           $.proxy(function(status) {
                               this.status = status;
                           }, this));

    this.status = Media.MEDIA_NONE;
}

/**
 * Play audio track.
 */
Audio.prototype.play = function() {
    this.media.play();

    $('#annotate-audio-button').removeClass('annotate-audio-stopped');
    $('#annotate-audio-button').addClass('annotate-audio-started');


    this.mediaTimer = setInterval($.proxy(function(){
        this.media.getCurrentPosition(
            $.proxy(function(position) {
                if (position > -1) {
                    $('#annotate-audio-position').text(position.toFixed(1));
                }
            }, this),
            // error callback
            function(e) {
                console.error("Error getting pos=" + e);
            }
        );
    }, this), 100);
};

/**
 * Release audio resources.
 */
Audio.prototype.destroy = function(){
    if(this.media){
        this.media.release();
    }
};

/**
 * Pause audio track.
 */
Audio.prototype.pause = function(){
    if (this.media){
        this.media.pause();
    }
};

/**
 * Stop audio track.
 */
Audio.prototype.stop = function(){
    if (this.media){
        this.media.stop();
    }

    this.clear();
};

/**
 * Clear audio track.
 */
Audio.prototype.clear = function(){
    clearInterval(this.mediaTimer);
    this.mediaTimer = null;

    $('#annotate-audio-position').text('0.0');

    $('#annotate-audio-button').addClass('annotate-audio-stopped');
    $('#annotate-audio-button').removeClass('annotate-audio-started');
};

/**
 * Audio track has successfully played.
 */
Audio.prototype.onSuccess = function(position){
    this.clear();
};

/**
 * Error playing audio track.
 */
Audio.prototype.onError = function(error){
    navigator.notification.alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
};
