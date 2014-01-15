define(function(where){
    return {
            init: function(page, where){
                require(['templates/'+where, 'text!templates/'+where+'.html'], function(data, tmpl) {
                    var template = _.template(tmpl);
                    $("#"+page+"-"+where).html(template(data)).trigger('create');
                });
            }
        }
});