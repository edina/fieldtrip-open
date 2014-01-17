/*
Copyright (c) 2014, EDINA,
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
    console.log(filesdata);

    //check if js file exists in custom folder
    var checkForFile = function(where){
        for(var f in filesdata["templates"]["custom"]){
            if(filesdata["templates"]["custom"][f] === where+".js"){
                return true;
            }
        }
        return false;
    }

    //create the array for the list in require call
    var getRequiredFiles = function(where){
        var requiredFiles = ['templates/default/'+where, 'text!templates/default/'+where+'.html'];
        if(checkForFile(where)){
            requiredFiles.push('templates/custom/'+where)
        }
        return requiredFiles;
    }

    return {
        init: function(page, where){
            var requiredFiles = getRequiredFiles(where);
            require(requiredFiles, function(data, tmpl, ndata) {
                var template = _.template(tmpl);
                $.extend(data, ndata);
                $("#"+page+"-"+where).html(template({"data": data})).trigger('create');
            });
        }
    }
});
