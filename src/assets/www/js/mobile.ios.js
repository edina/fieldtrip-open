
function IosUI(options) {
    var parent = new UI(options);

    //customised init for ios
    parent.init = function (){
        //call UI super init
        UI.prototype.init.call(this);


    };

    parent.mapPage = function (){
        //super call to manPage
        UI.prototype.mapPage.call(this);
        //no need for -+ zoom buttons
        $('.map-zoom-buttons').hide();

    }
    
    parent.cachedMapsPage = function () {
        this.commonMapPageInit('saved-maps-map');
        
        //show saved map delete and display maps
        
        var maps = this.cache.getSavedMaps();
        var count = 0;
        if(maps){
            // build saved maps list
            $.each(maps, function(index, value){
                   $('#saved-maps-list-list').append(
                                                     '<li><fieldset class="ui-grid-b"> \
                                                     <div class="ui-block-a">\
                                                     <a href="#" class="saved-map-click">\
                                                     <h3>' + index + '</h3></a>\
                                                     </div>\
                                                     <div class="ui-block-b">\
                                                     <a href="#" class="saved-map-delete" data-role="button" data-icon="delete" data-iconpos="notext" data-theme="a"></a>                        \
                                                     </div>\
                                                     <div class="ui-block-c">\
                                                     <a href="#" class="saved-map-view" data-role="button" data-icon="arrow-r" data-iconpos="notext" data-theme="a"></a>                        \
                                                     </div>\
                                                     </fieldset>\
                                                     </li>').trigger('create');
                   ++count;
                });
            
        }
        

        
        if(count === 0){
            $('#saved-maps-list').html('<p class="large-text">No saved maps - go to <a href="save-map.html">Download</a> to create saved maps</p>');
        
        } else if(count < Cache.MAX_NO_OF_SAVED_MAPS){
            $('#saved-maps-list').append('<p class="large-text"><a href="save-map.html">Download more maps</a></p>');
        }

        // display a saved map on main map
        var displayOnMap = $.proxy(function(){
                                   var name = this.selectedSavedMap.find('h3').text();
                                   var details = this.cache.getSavedMapDetails(name);
                                   
                                   if(details){
                                   this.map.showSavedMaps(details);
                                   }
                                   }, this);
        
        
        $('.saved-map-view').click($.proxy(function(event){
                                           // view selected
                                           $.mobile.changePage('map.html');
                                           displayOnMap();
                                           }, this));
        
        $('.saved-map-delete').click($.proxy(function(event){
                                             // view selected
                                             this.selectedSavedMap.toBeDeleted = true;
                                             if(this.selectedSavedMap.toBeDeleted){
                                             
                                             $('#saved-maps-delete-popup').popup('open');
                                             }
                                             
                                             }, this));
        
        
        
        // context menu popup
        
        
        $('#saved-maps-delete-popup-confirm').click($.proxy(function(event){
                                                            // confirm map delete
                                                            this.cache.deleteSavedMapDetails(this.selectedSavedMap.find('h3').text());
                                                            $('#saved-maps-delete-popup').popup("close");
                                                            $(this.selectedSavedMap).slideUp('slow');
                                                            }, this));
        
        // click on a saved map
        $('.saved-map-click').bind(
                                   'click',
                                   $.proxy(function(event){
                                           
                                           this.selectedSavedMap = $(event.target).parents('li');
                                           //reset delete/view buttons
                                           $('#saved-maps-list-list .ui-block-b, #saved-maps-list-list .ui-block-c' ).hide();
                                           
                                           
                                           var uiBlockA = $(event.target).parent().parent();
                                           // contains delete button
                                           var uiBlockB = uiBlockA.next();
                                           uiBlockB.show();
                                           // contains the view map button
                                           var uiBlockC = uiBlockB.next();
                                           uiBlockC.show();
                                           
                                           displayOnMap();
                                           
                                           }, this));
        
        
        // make map list scrollable on touch screens
        Utils.touchScroll('#saved-maps-list');
        
        $('#saved-maps-list-list').listview('refresh');
        
        // show first map on list
        this.selectedSavedMap = $('#saved-maps-list li:first');
        displayOnMap();
    };
    
    
    
    return parent;
}



