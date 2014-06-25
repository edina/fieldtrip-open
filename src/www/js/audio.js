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

define(function(){

    var currentAudio;

    var MAX_VOLUME = 5;
    var volume = MAX_VOLUME;
    
/*** Audio Object decorates a Cordova Media Object ************/

    /***
    * param src - the location of the audio.
    **/
    var createNewAudio = function(src) {
        var audio = {};
        audio.src = src;
        audio.status = Media.MEDIA_NONE;
       
       
        
        /**
         * Audio track has successfully played.
         */
        audio.onSuccess = function(position){
            audio.clear();
        };

        /**
         * Error playing audio track.
         */
        audio.onError = function(error){
            alert('code: '    + error.code    + '\n' +
                  'message: ' + error.message + '\n');
        };
       

       
        audio.media = new Media(src,
                                audio.onSuccess,
                                audio.onError,
                                function(status) {audio.status = status;}
                                );
       
       
        audio.play =  function(){
       
            audio.media.play();

            $('#annotate-audio-button').removeClass('annotate-audio-stopped');
            $('#annotate-audio-button').addClass('annotate-audio-started');

            // update media position every second
            if(audio.mediaTimer == null) {
                audio.mediaTimer = setInterval(function(){
                    audio.media.getCurrentPosition(
                       function(position) {
                            if (position > -1) {
                                $('#annotate-audio-position').text((position.toFixed(1)) + ' sec');
                            }
                        },
                        // error callback
                        function(e) {
                            console.error("Error getting pos=" + e);
                        }
                    );
                }, 1000);
            }

        };
        /**
         * Release audio resources.
         */
        audio.destroy = function(){
            if(audio.media){
                audio.media.release();
            }
        };



        /**
         * Pause audio track.
         */
        audio.pause = function(){
            if (audio.media){
                audio.media.pause();
            }
        };

        /**
         * Stop audio track.
         */
        audio.stop = function(){
            if (audio.media){
                audio.media.stop();
            }

            audio.clear();
        };
       
       
        /**
         * Clear audio track.
         */
        audio.clear = function(){
            clearInterval(audio.mediaTimer);
            audio.mediaTimer = null;

            $('#annotate-audio-position').text('0.0 sec');

            $('#annotate-audio-button').addClass('annotate-audio-stopped');
            $('#annotate-audio-button').removeClass('annotate-audio-started');
        };



        return audio;


    }
    
/************************** End Audio Object ***************************/

return{

    /**
     * Generate play audio node.
     * @param url Audio file URL.
     * @param label Optional text label.
     */
    getNode: function(url, label){
        if(label === undefined){
            label = '';
        }

        return '<div class="annotate-audio-taken">' + label + '\
<input type="hidden" value="' + url + '"/>\
<p id="annotate-audio-position" >0.0 sec</p>\
<a id="annotate-audio-button" class="annotate-audio-stopped" aria-label="play audio" data-theme="a" data-iconpos="notext" href="#" data-role="button" role="button"></a>\
    <div aria-label="Volume Controls" class="volume-control-buttons" role="toolbar"> \
        Volume (0 to ' + MAX_VOLUME + ') : \
        <span id="vol-level" class="annotate-vol-level" aria-label="Volume Level" >' + volume  +'</span>\
      <a aria-label="Increase Volume" id="increase-vol-button" data-role="button" role="button" >\
        Vol +\
      </a>\
      <a aria-label="Decrease Volume" id="decrease-vol-button" data-role="button" role="button">\
        Vol -\
      </a>\
    </div>\
</div>';
    },
    /**
    * Play audio track.
    */
    playAudio: function(){
       
        var url = $('.annotate-audio-taken input').attr('value');

        // for android ensure url begins with file:///
        url = url.replace("file:/m", "file:///m");
        
        //media player plugin has not been updated to latest cdvfile format
        //see https://github.com/edina/spatial-memories/issues/45
        url = url.replace("cdvfile://localhost/persistent/" , "documents://");

        if(currentAudio){
       
            if(currentAudio.src !== url){
                currentAudio.destroy();
                currentAudio = createNewAudio(url);
            }
        } else {
            currentAudio = createNewAudio(url);
        }
       
       
        if(currentAudio.status === Media.MEDIA_RUNNING ||
            currentAudio.status === Media.MEDIA_STARTING){
            currentAudio.stop();
        } else{
            currentAudio.play();
            currentAudio.media.setVolume(volume / MAX_VOLUME );
        }
    },
    increaseVolume : function(){

        volume = (volume === MAX_VOLUME)  ? MAX_VOLUME : volume + 1;
    
        this.updateVolumeIfPlaying();
    

    },
    decreaseVolume : function(){

        volume = (volume === 0) ? 0 : volume - 1;
        
        this.updateVolumeIfPlaying();
    
    },
    updateVolumeIfPlaying : function(){

        $('#vol-level').text(volume);
        if(currentAudio && currentAudio.status){
            if(currentAudio.status === Media.MEDIA_RUNNING || currentAudio.status === Media.MEDIA_STARTING ){
                
                currentAudio.media.setVolume(volume/MAX_VOLUME);
            }
        }

    }
}

});



