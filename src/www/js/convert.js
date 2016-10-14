/*
Copyright (c) 2016, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
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

'use strict';

define(function(require){
    var utils = require('utils');

    /**
     * Replace charachters with the equivalent html5 entity
     * @param a string of text
     * @returns a text with the characters escaped
     */
    var encodeEntities = function (text) {
        return $('<div />').text(text).html();
    };

    /**
     * convert JSON string to html string
     * @param form a JSON representing the form
     * @param fileName of the editor
     */
    var jsonToHtml = function(jsonStr, fileName) {
        var self = this;
        var form = JSON.parse(jsonStr);

        //add title
        form.title = form.title.replace('"', '&quot;');
        var html = '<form data-title=\"'+
                  form.title+'\" data-ajax=\"false\" novalidate>\n';

        //add geometry
        html+='<div class="fieldcontain fieldcontain-geometryType"'+
          ' id="fieldcontain-geometryType" data-cobweb-type="geometryType">\n';
        html+='<input type="hidden" data-record-geometry="'+
            form.geoms.join(",")+'" value="'+form.geoms.join(",")+'">\n';
        html+='</div>\n';

        var titleField;
        if(utils.checkNested(form, 'recordLayout', 'headers')){
            // if header array is defined use first element as record title field
            titleField = form.recordLayout.headers[0];
        }

        form = form || [];
        form.fields.forEach(function(value) {
            var key = value.id;
            var properties = value.properties;
            var type = value.type;

            var required = "";
            if(value.required) {
                required = 'required="required"';
            }
            var persistent = "";
            if(value.persistent) {
                persistent = 'data-persistent="on"';
            }
            var visibility = "";
            if(properties.visibility) {
                visibility = 'data-visibility="fieldcontain-'+
                  properties.visibility.id.replace("fieldcontain-", "")+
                  ' '+properties.visibility.operator+' \''+properties.visibility.answer+'\'"';
            }

            value.label = encodeEntities(value.label);
            switch (type) {
            case 'text':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                      '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                      visibility+'>\n';
                    html+='<label for="form-'+key+'">'+
                        value.label+'</label>\n';
                    var inputValue = "";
                    if(properties.prefix) {
                        inputValue = properties.prefix + " (" + utils.getSimpleDate() + ")";
                    }
                    html+='<input name="form-'+key+'" id="form-'+key+
                              '" type="text" '+required+' placeholder="'+properties.placeholder+
                              '" maxlength="'+properties["max-chars"]+'" value="'+inputValue+'"';

                    if (key === titleField){
                        html += ' data-title="true"';
                    }

                    html+='>\n</div>\n';
                    break;
                case 'textarea':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                        '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<label for="form-'+key+'">'+
                        value.label+'</label>\n';
                    var imageCaption;
                    if((imageCaption=properties['image-caption']) || (imageCaption=properties.imageCaption))
                    {
                      html+='<img src="'+ getFilenameFromURL(imageCaption.src)+'">\n';
                    }

                    if(properties.readOnly === true)
                    {
                    html+='<textarea name="form-'+key+'" id="form-'+key+
                              '" '+required+' rows=' + properties.numrows+ ' readOnly placeholder="'+properties.placeholder +
                              '"></textarea>\n';
                    }
                    else {

                      html+='<textarea name="form-'+key+'" id="form-'+key+
                                '" '+required+' rows=' + properties.numrows  +' placeholder="'+properties.placeholder +
                                '"></textarea>\n';
                    }

                    html+='</div>\n';
                    break;
                case 'range':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                        '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<label for="form-'+key+'">'+
                        (value.label)+'</label>\n';
                    html+='<input name="form-'+key+'" id="form-'+key+
                              '" type="range" '+required+' placeholder="'+properties.placeholder+
                              '" step="'+properties.step+'" value="'+properties.min+'" min="'+properties.min+'" max="'+properties.max+'">\n';
                    html+='</div>\n';
                    break;
                case 'checkbox':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                        '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<fieldset>\n<legend>'+value.label+'</legend>\n';
                    properties.options.forEach(function(v, k) {
                        if("image" in v) {


                            html+='<label for="'+key+'-'+k+'">\n';
                            html+='<div class="ui-grid-a grids">\n';
                            html+='<div class="ui-block-a"><p>'+v.value+'</p></div>\n';
                            html+='<div class="ui-block-b"><img src="'+
                                getFilenameFromURL(v.image.src)+'"></div></div>\n';
                            html+='</label>';
                            html+='<input name="'+key+'-'+k+'" id="'+key+
                                  '-'+k+'" value="'+v.value+'" type="'+type+'" '+
                                  required+'>\n';
                        }
                        else {
                            html+='<label for="'+key+'-'+k+'">'+v.value+'</label>\n';
                            html+='<input name="'+key+'-'+k+'" id="'+
                                key+'-'+k+'" value="'+v.value+'" type="'+type+'" '+
                                required+'>\n';
                        }
                    });
                    if (value.properties.other === true) {
                        html+='<label for="'+key+'-'+properties.options.length+
                            '" class="other">' +$.i18n.t('form:other')+
                            '</label>\n';
                        html+='<input name="'+key+'" id="'+key+'-'+
                            properties.options.length+'" value="other"'+
                            ' class="other" type="'+type+'" '+required+'>\n';
                    }
                    html+='</fieldset>\n</div>\n';
                    break;
                case 'radio':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                        '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<fieldset>\n<legend>'+value.label+'</legend>\n';
                    properties.options.forEach(function(v, k) {
                        if("image" in v){
                            html+='<label for="'+key+'-'+k+'">\n';
                            html+='<div class="ui-grid-a grids">\n';
                            html+='<div class="ui-block-a"><p>'+v.value+'</p></div>\n';
                            html+='<div class="ui-block-b"><img src="'+
                                getFilenameFromURL(v.image.src)+'"></div></div>\n';
                            html+='</label>';
                            html+='<input name="'+key+'" id="'+key+'-'+k+
                                '" value="'+v.value+'" type="'+
                                type+'" '+required+'>\n';
                        }
                        else {
                            html+='<label for="'+key+'-'+k+'">'+v.value+'</label>\n';
                            html+='<input name="'+key+'" id="'+key+'-'+
                                k+'" value="'+v.value+'" type="'+type+'" '+required+'>\n';
                        }
                    });
                    if (value.properties.other === true) {
                        html+='<label for="'+key+'-'+
                            properties.options.length+'" class="other">' +
                            $.i18n.t('form:other')  + '</label>\n';
                        html+='<input name="'+key+'" id="'+key+'-'+
                            properties.options.length+'" value="other" class="other" type="'+
                            type+'" '+required+'>\n';
                    }
                    html+='</fieldset>\n</div>\n';
                    break;
                case 'select':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+'"'+
                        ' data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<fieldset>\n<legend>'+value.label+'</legend>\n';
                    if(required !== ""){
                        html+='<select name="form-'+key+'" required="required">\n';
                        html+='<option value=""></option>\n';
                    }
                    else{
                        html+='<select name="form-'+key+'">\n';
                    }
                    properties.options.forEach(function(v, k) {
                        html+='<option value="'+v.value+'">'+v.value+'</option>\n';
                    });
                    html+='</select>\n</fieldset>\n</div>\n';
                    break;
                case 'dtree':
                    html+='<div class="fieldcontain" id="fieldcontain-'+
                        key+'" data-fieldtrip-type="'+type+'" '+visibility+'>\n';
                    html+='<fieldset>\n<label for="form-'+
                        key+'">'+value.label+'</label>\n';
                    html+='<div class="button-wrapper button-dtree"></div>\n';
                    html+='</fieldset>\n';
                    html+='<input type="hidden" name="form-'+key+'" data-dtree="'+
                        utils.getFilename(fileName) +"/"+ properties.filename+
                        '" value="'+properties.filename+'">\n';
                    html+='</div>\n';
                    break;
                case 'multiimage':
                case 'image':
                    var cl = "camera";
                    if(properties["multi-image"] === true){
                        key = key.replace("image", "multiimage");
                    }
                    if(properties.los === true){
                        cl = "camera-va";
                    }
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+'"'+
                         ' data-fieldtrip-type="'+cl+'" '+visibility+'>\n';
                    html+='<div class="button-wrapper button-'+cl+'">\n';
                    html+='<input name="form-image-1" id="form-image-1"'+
                        ' type="file" accept="image/png" capture="'+cl+'" '+
                        required+' class="'+cl+'">\n';
                    html+='<label for="form-image-1">'+value.label+'</label>\n';
                    if (properties.blur) {
                        html+='<div style="display:none;" id="blur-threshold" value="' + properties.blur + '"></div>';
                    }
                    html+='</div>\n</div>\n';
                    break;
                case 'audio':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+'" data-fieldtrip-type="microphone" '+visibility+'>\n';
                    html+='<div class="button-wrapper button-microphone">\n';
                    html+='<input name="form-audio-1" id="form-audio-1" type="file" accept="audio/*" capture="microphone" '+required+' class="microphone">\n';
                    html+='<label for="form-audio-1">'+value.label+'</label>\n';
                    html+='</div>\n</div>\n';
                    break;
                case 'gps':

                    break;
                case 'warning':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+'" data-fieldtrip-type="'+type+'">\n';
                    html+='<label for="form-'+key+'">'+value.label+'</label>\n';
                    html+='<textarea name="form-'+key+'" id="form-'+key+
                              '" '+required+' placeholder="'+properties.placeholder+
                              '"></textarea>\n';
                    html+='</div>\n';
                    break;
                case 'section':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+'" data-fieldtrip-type="'+type+'">\n';
                    html+='<h3>'+value.label+'</h3>\n';
                    html+='</div>\n';
                    break;
                case 'static-image':
                    html+='<div class="fieldcontain" id="fieldcontain-'+key+
                        '" data-fieldtrip-type="'+type+'" '+persistent+' '+
                        visibility+'>\n';
                    html+='<h3>'+value.label+'</h3>\n';
                    var imageCaption2;
                    if((imageCaption2=properties['image-caption']) || (imageCaption2=properties.imageCaption))
                    {
                      html+='<img src="'+ getFilenameFromURL(imageCaption2.src)+'">\n';
                    }
                    html+='<p>'+properties.caption+'</p>\n';
                    html+='</div>\n';
                    break;
            }
        });
        html+='<div id="save-cancel-editor-buttons" class="fieldcontain ui-grid-a">\n';
        html+='<div class="ui-block-a">\n';
        html+='<input type="submit" name="record" value="Save">\n';
        html+='</div>\n';
        html+='<div class="ui-block-b">\n';
        html+='<input type="button" name="cancel" value="Cancel">\n';
        html+='</div>\n';
        html+='</div>\n';
        html+='</form>';

        return html;
    };

    var getFilenameFromURL = function(path) {
        return path.substring(path.length, path.lastIndexOf('/')+1);
    };

    return {
        json2html: function(formPath, fileName){
            var deferred = new $.Deferred();
            $.ajax({
                url: formPath,
                cache:false,
                dataType: "text",
                success: function(data){
                    deferred.resolve(jsonToHtml(data, fileName));
                },
                error: function(jqXHR, status, error){
                    var msg = "Problem with " + formPath + " : status=" +
                        status + " : " + error;
                    console.error(msg);
                    deferred.reject(msg);
                },
            });

            return deferred.promise();
        }
    };
});
