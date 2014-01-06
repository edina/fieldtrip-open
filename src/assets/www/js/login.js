var PREVIOUS_LOGIN = 'previous-logins';

$(function() {
    new Login();
});

// digimap login class
var Login = function(options) {
    this.db = window.localStorage;
    var inFocus = 0;

    var showHeader = getParameterByName('showHeader')
    if(showHeader === '0' || showHeader.toLowerCase() === 'false' || showHeader.toLowerCase === 'f'){
        $('#login-header h1').text('');
    }

    $('#login-header .ui-btn-left').hide();
    $('#search-spinner').hide();

    $.getJSON('js/ukfed.json', $.proxy(function(data){
        this.ukfed = data;
        this.alphabetical = [];

        for(var id in this.ukfed){
            this.alphabetical.push([this.ukfed[id].name, id]);
        }

        this.alphabetical.sort();

        var logins = getPreviousLogins();

        if(logins.length === 0){
            $('#login-page-previous').hide();
        }
        else{
            for(var i = 0; i < logins.length; i++){
                var shibbId = logins[i];
                var name = this.ukfed[shibbId].name;
                var id = "previous-login-entry-" + shibbId;
                var html = '<li id="' + id + '"><a class="previous-login-entry" href="#">' + name + '</a><a class="previous-login-delete" href="#" data-transition="slideup"></a></li>';
                $('#login-page-previous-list').append(html);
            }
            $('#login-page-previous-list').listview("refresh");

            // click on previous login entry
            $('.previous-login-entry').click($.proxy(function(event) {
                this.entryClick(event)
            }, this));

            // click to delete previous login entry
            $('.previous-login-delete').click(function(event) {
                var id = $(this).parent().attr('id');
                var shibbId = id.substr(id.lastIndexOf('-') + 1);
                removePreviousLogin(shibbId);
                $('#' + id).slideUp('slow');

                if(getPreviousLogins().length === 0){
                    $('#login-page-previous').slideUp('slow');
                }
            });
        }

    }, this));

    // get nearby institutions
    var lon = getParameterByName('lon');
    var lat = getParameterByName('lat');
    if(lon && lat){
        var url = '/mygeo/sort/?name=ukfed&no_of_locations=5&lon= ' + lon + '&lat=' + lat;
        $.get(url, $.proxy(function(data){
            $.each($(data).find('location'), $.proxy(function(i, location){
                var shibbId = $(location).find('id').text();
                var name = this.ukfed[shibbId].name;
                var id = "login-page-near-entry-" + shibbId;
                var html = '<li id="' + id + '"><a class="login-page-near-entry" href="#">' + name + '</a></li>';
                $('#login-page-near').append(html);
            }, this));

            $('#login-page-near').listview("refresh");

            // click on nearby institution
            $('.login-page-near-entry').click($.proxy(function(event) {
                this.entryClick(event);
            }, this));

        }, this));
    }

    $('#login-page-search').keyup($.proxy(function(event){
        if ((event.keyCode === 38) || (event.keyCode === 40)){
            // up or down arrow has been clicked focus on entry
            $($('#login-page-search-results li')).blur();
            if(event.keyCode === 38){
                if(inFocus >= 0){
                    --inFocus;
                }
            }
            else{
                if(inFocus < $('#login-page-search-results li').length){
                    ++inFocus;
                }
            }

            $($('#login-page-search-results li')[inFocus]).focus();
        }
        else if(event.keyCode === 13){
            // enter pressed
            var entry = $('#login-page-search-results li')[inFocus];
            if(entry){
                var id = $(entry).find('input').val();
                this.redirectToLogin(id);
            }
        }
        else{

            // ignore non character keys (except delete) and anything less than 3 characters
            if((String.fromCharCode(event.keyCode).match(/\w/) || event.keyCode === 8) &&
               $('#login-page-search').val().length > 2){
                inFocus = -1;
                this.autocomplete();
            }
        }
    }, this));

    // this is an attempt to get the focus on the search textfield,
    // works on the desktop but doesn't on android
    setTimeout(function(){
        $('#login-page-search').focus();
    }, 1000);
};


// kick off autocomplete with input
Login.prototype.autocomplete = function(){
    if(this.timer){
        clearTimeout(this.timer);
    }

    this.timer = setTimeout($.proxy(this.perform, this), 500);
};


// click on a list entry
Login.prototype.entryClick = function(event){
    var id = $(event.target).closest('li').attr('id');
    var shibbId = id.substr(id.lastIndexOf('-') + 1);
    this.redirectToLogin(shibbId);
};


// perform institution lookup based on user input
Login.prototype.perform = function(){
    $('#search-spinner').show();

    $('#login-page-search-results').empty();
    var searchTerm = $('#login-page-search').val();

    for (var i = 0; i < this.alphabetical.length; i++) {
        var name = this.alphabetical[i][0];

        if(name.toLowerCase().indexOf(searchTerm.toLowerCase()) != -1){
            var id = this.alphabetical[i][1];
            var html = '<li class="search-result-entry"><a href="#">' + name + '</a><input type="hidden" value="' + id + '" /></li>';
            $('#login-page-search-results').append(html);
        }
    }

    if($('#login-page-search-results li').length > 0){
        $('#login-page-search-results').listview("refresh");

        $('.search-result-entry').click($.proxy(function(event) {
            var id = $(event.currentTarget).find('input').val();

            // redirct to shibb login
            this.redirectToLogin(id);
        }, this));
    }

    $('#search-spinner').hide();
};


Login.prototype.redirectToLogin = function(id){
    // remember this login
    setPreviousLogin(id);

    var url = 'https://wayf.ukfederation.org.uk/DS002/uk.ds?target=cookie&shire=https%3A%2F%2Fvsp2.edina.ac.uk%2Fdigimap%2FShibboleth.sso%2FSAML%2FPOST&providerId=https%3A%2F%2Fgeoshibb.edina.ac.uk%2Fshibboleth&cache=perm&action=selection&origin=' + this.ukfed[id].url;

    // redirct to shibb login
    window.location.replace(url);
};


// get all saved previous logins
function getPreviousLogins(){
    var logins = [];
    var previousLoginsArray = window.localStorage.getItem(PREVIOUS_LOGIN);
    if(previousLoginsArray){
        try{
            logins = JSON.parse(previousLoginsArray);
        }
        catch(error){
            // somethings went wrong with save, delete contents
            console.error(error);
            window.localStorage.removeItem(PREVIOUS_LOGIN);
        }
    }

    return logins;
};


// store a previous login
function setPreviousLogin(id){
    var previous = getPreviousLogins();

    if(previous === null){
        previous = [];
    }

    if($.inArray(id, previous) === -1){
        previous[previous.length] = id;
        window.localStorage.setItem(PREVIOUS_LOGIN, JSON.stringify(previous));

    }
};


// delete a previous login
function removePreviousLogin(id){
    var previous = getPreviousLogins();

    if(previous !== null){
        previous = $.grep(previous, function(value) {
            return value != id;
        });

        window.localStorage.setItem(PREVIOUS_LOGIN, JSON.stringify(previous));
    }
};


function getParameterByName(name){
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if(results === null)
        return "";
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
};
