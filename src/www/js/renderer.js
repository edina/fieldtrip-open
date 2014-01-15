define(function(where){
    return {
            init: function(where){
                require(['templates/'+where, 'text!templates/'+where+'.html'], function(data, tmpl) {
                    var template = _.template(tmpl);
                    $("#home-"+where).html(template(data)).trigger('create');
                });
            }
        }
});