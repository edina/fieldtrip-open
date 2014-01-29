define(function(){
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
<p id="annotate-audio-position">0.0 sec</p>\
<a id="annotate-audio-button" class="annotate-audio-stopped" onclick="playAudio();" data-theme="a" data-iconpos="notext" href="#" data-role="button" ></a>\
</div>';
    },
}

});

// current/last played audio
var currentAudio;

/**
 * Play audio track.
 */
function playAudio(){
    var url = $('.annotate-audio-taken input').attr('value');

    // for android ensure url begins with file:///
    url = url.replace("file:/m", "file:///m");

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
};

/**
 * Audio media class.
 * @param src The media file.
 */
function Audio(src){
    // Create Media object from src
    this.media = new Media(src,
                           $.proxy(this.onSuccess, this),
                           $.proxy(this.onError, this),
                           $.proxy(function(status) {
                               this.status = status;
                           }, this));

    this.status = Media.MEDIA_NONE;
};

/**
 * Play audio track.
 */
Audio.prototype.play = function() {
    this.media.play();

    $('#annotate-audio-button').removeClass('annotate-audio-stopped');
    $('#annotate-audio-button').addClass('annotate-audio-started');

    // update media position every second
    if(this.mediaTimer == null) {
        this.mediaTimer = setInterval($.proxy(function(){
            this.media.getCurrentPosition(
                $.proxy(function(position) {
                    if (position > -1) {
                        $('#annotate-audio-position').text((position.toFixed(1)) + ' sec');
                    }
                }, this),
                // error callback
                function(e) {
                    console.error("Error getting pos=" + e);
                }
            );
        }, this), 1000);
    }
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

    $('#annotate-audio-position').text('0.0 sec');

    $('#annotate-audio-button').addClass('annotate-audio-stopped');
    $('#annotate-audio-button').removeClass('annotate-audio-started');
}

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
    alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
};
