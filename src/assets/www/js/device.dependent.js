"use strict"

var deviceDependent = {

    init:function (isIos){

        var iosMethods = {
            setUpExitButton: function (){
                //hide the exit button on ios
                $('#home-exit').hide();
            },
            getImageSizeControl:function (){

               var fullSelected = '', normalSelected = '', CHECKED = 'checked';

               if(localStorage.getItem(Annotations.IMAGE_UPLOAD_SIZE) === Annotations.IMAGE_SIZE_FULL){
                  fullSelected = CHECKED;
               } else {
                  normalSelected = CHECKED;
               }
               return '<div class="ui-block-c">\
                              <fieldset data-role="controlgroup" data-type="horizontal"> \
                                 <input type="radio" name="radio-image-size" id="radio-view-a" value="imageSizeNormal" ' + normalSelected +' /> \
                                 <label for="radio-view-a">Normal</label> \
                                 <input type="radio" name="radio-image-size" id="radio-view-b" value="imageSizeFull" ' + fullSelected + ' /> \
                                 <label for="radio-view-b">Full</label>\
                              </fieldset><p>Image Size</p>\
                        </div>';

            },
            // root directory name on filesystem
            getRootDir: function(){
                return "edina";
            },
            addImageSizeProperties: function(options){

               if(localStorage.getItem(Annotations.IMAGE_UPLOAD_SIZE) === Annotations.IMAGE_SIZE_FULL){
                  delete options.targetWidth;
                  delete options.targetHeight
               } else {
                  options.targetWidth = 640;
                  options.targetHeight = 480;


               }
               return options;

            },
            preventGalleryScanning: function(){
               //only android has gallery scanning by default.

            }

        }

        var androidMethods = {

            setUpExitButton: function (){}
            ,
            getImageSizeControl:function (){
               return iosMethods.getImageSizeControl()
            },
            // root directory name on filesystem
            getRootDir: function(){
                return "Android/data/uk.ac.edina.mobile";
            },
            addImageSizeProperties: function(options){
               return iosMethods.addImageSizeProperties(options);
            },
            preventGalleryScanning: function(cacheDir){

            // creating .Nomedia file in cache directory prevents gallery
            // scanning directory

               cacheDir.getFile(
                    ".Nomedia",
                    {create: true, exclusive: false},
                    function(parent){},
                    function(error){
                        console.error("Failed to create .Nomedia" + error.code);
                    }
               );

            }

        }

        if(isIos){
            $.extend(deviceDependent, iosMethods);
        } else {
            $.extend(deviceDependent, androidMethods);
        }

    }
}
