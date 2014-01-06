/**
 * Offline Map caching class.
 * @params options:
 *    map - main map object
 *    db  - storage object
 */
var Cache = function(options) {
    this.map = options.map;
    this.db = options.db;

    this.maxDownloadStr = Utils.bytesToSize(Cache.MAX_CACHE);

    //now lets check to see if we have toDataURL support for android if not use JPEGEncoder
    var tdu = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
        return res;
    }
};

Cache.AV_TILE_SIZE = 16384; // in bytes 16 KB
Cache.MAX_CACHE = 52428800; // per download - 50 MB
Cache.MAX_NO_OF_SAVED_MAPS = 3;

Cache.SAVED_MAPS = 'saved-maps-v2';
Cache.SAVED_MAPS_VERSION_1 = 'saved-maps'

/**
 * Get list of saved maps.
 * @return Associative array of stored maps.
 */
Cache.prototype.getSavedMaps = function(){
    var maps;

    var obj = this.db.get(Cache.SAVED_MAPS)

    if(obj){
        try{
            maps = JSON.parse(obj);
        }
        catch(ReferenceError){
            console.error('Problem with:');
            console.error(Cache.SAVED_MAPS);
            this.db.remove(Cache.SAVED_MAPS);
        }
    }

    return maps;
};

/**
 * @return Current number of saved maps.
 */
Cache.prototype.getSavedMapsCount = function(){
    var count = 0;

    for(var i in this.getSavedMaps()){
        ++count;
    }

    return count;
}

/**
 * Save current saved maps to localstorage.
 * @param maps Dictionary of maps.
 */
Cache.prototype.setSavedMap = function(maps){
    this.db.set(Cache.SAVED_MAPS, JSON.stringify(maps));
};

/**
 * Get saved map details.
 * @param name The name of the saved map.
 * @return Saved map details object.
 */
Cache.prototype.getSavedMapDetails = function(name){
    var mapDetails = undefined;
    var maps = this.getSavedMaps();

    if(maps){
        mapDetails = maps[name];
    }

    return mapDetails;
};

/**
 * Save the associated details of a saved map.
 * @param name Map name.
 * @param details The associated details.
 */
Cache.prototype.setSavedMapDetails = function(name, details){
    var maps = this.getSavedMaps();
    if(!maps){
        maps = {};
    }

    maps[name] = details;

    this.setSavedMap(maps);
};

/**
 * Rename a saved map.
 * @param oldName
 * @param newName
 * @returns True if map name is updated.
 */
Cache.prototype.renameSavedMap = function(oldName, newName){
    var success = false;

    if(newName.length > 0 && oldName !== newName){
        var maps = this.getSavedMaps();
        var details = maps[oldName];
        if(details){
            delete maps[oldName];
            maps[newName] = details;
            this.setSavedMap(maps);
            success = true;
        }
    }

    return success;
};



/**
 * Remove saved map details from local storage.
 * @param name Saved map name.
 */
Cache.prototype.deleteSavedMapDetails = function(mapName){
    var maps = this.getSavedMaps();



    var getLocalMapDir = function(cacheDir, name){
        // remove file:// from cachedir fullpath

        var path = cacheDir.fullPath;
        if(path.slice(0,7) === "file://"){
            path = path.substr(7);
        }
        return path + "/"+ name + "/" ;
    };


    var localMapDir = getLocalMapDir(this.cacheDir, mapName);

    var onGetDirectorySuccess = function(directory){;

        var success = function (parent) {
            webdb.deleteMap(mapName);
        }

        var fail = function(error) {
             console.error("Remove Recursively Failed" + error.code);

        }
        directory.removeRecursively(success, fail);


    }

    var onGetDirectoryFail = function (error) {
        console.error("*********** problem getting map tiles dir *********");
        console.error(error.code);
    }

    this.cacheDir.getDirectory(localMapDir, {create: false, exclusive: false}, onGetDirectorySuccess, onGetDirectoryFail);


    if(maps){
        var todo = 0;
        $.mobile.loading( 'show' ,{text:'Deleting Tiles'});

         $.mobile.hidePageLoadingMsg();

        delete maps[mapName];
        this.setSavedMap(maps);
    }
}

/**
 * Preview cache map mouse down.
 */
Cache.prototype.previewImagesMouseDown = function(){
    this.mouseDown = true;
    this.previewImages();
    this.lastPreviewed = $('#cache-slider').val();
};

/**
 * Preview cache map mouse up.
 */
Cache.prototype.previewImagesMouseUp = function(){
    this.mouseDown = false;
    $('#cache-preview').hide();
    $('#save-map-map').css('opacity', '1');
    $('.map-zoom-buttons').show();
    this.map.getBaseLayer().redraw();
};

/**
 * Preview cache map slider change.
 */
Cache.prototype.previewImagesChange = function(){
    // only redraw if slider value has changed
    if(this.mouseDown && this.lastPreviewed !== $('#cache-slider').val()){
        this.previewImages();
        this.lastPreviewed = $('#cache-slider').val();
    }

    // always update number of zoom levels
    $('#cache-save-details-zoom-level-but').val(
        $('#cache-slider').val() - this.map.getZoomLevels().current + 1);
    this.setSaveStats(this.map.getZoomLevels().current, $('#cache-slider').val());
};

/**
 * Display preview of cached images.
 */
Cache.prototype.previewImages = function(){
    if(!$('#cache-slider').slider("option", "disabled")){
        var current = parseInt($("#cache-save-slider input").val());
        var next = current + 1;
        var previous = current - 1;

        $('#cache-preview').show();

        // draw individual preview window
        var drawPreview = $.proxy(function(divId, zoom){
            $('#' + divId).show();

            var map = this.map.showMapPreview({
                name: divId,
                div: divId,
                zoom: zoom,
            });

            if($('#' + divId + '.olMap').length === 0){
                map.render(divId);
            }
        }, this);

        var zooms = this.map.getZoomLevels();
        var zoom = parseInt($('#cache-slider').val());
        if(previous >= 0 && previous >= zooms.current){
            // draw left panel
            drawPreview('cache-preview-left', zoom - 1);
        }
        else{
            $('#cache-preview-left').hide();
        }

        // draw centre panel
        drawPreview('cache-preview-centre', zoom);

        if(next <= zooms.max){
            // draw right panel
            drawPreview('cache-preview-right',  zoom + 1);
        }
        else{
            $('#cache-preview-right').hide();
        }

        $('#save-map-map').css('opacity', '0.0');
        $('.map-zoom-buttons').hide();
    }
};

/**
 * Cache tile images.
 * @param name Saved map name.
 * @param min Start zoom level to cache.
 * @param max End zoom level to cache.
 */
Cache.prototype.saveMap = function(mapName, min, max){
    mapName = Utils.santiseForFilename(mapName);
    var success = true;
    var dlSize = this.totalNumberOfTilesToDownload(min, max) * Cache.AV_TILE_SIZE;

    if(dlSize > Cache.MAX_CACHE){
        alert('Download size too large');
        success = false;
    }
    else{
        var details = this.getSavedMapDetails(mapName);

        if(details === undefined){
            this.count = 0;
            var layer = this.map.getBaseLayer();

            this.noOfTiles = dlSize / Cache.AV_TILE_SIZE;

            $.mobile.loading( 'show', { text: "Saving ..." });

            // store cached map details
            var details = {
                'poi': this.map.getCentre(),
                'bounds': this.map.getExtent(),
                'images': []
            }

            this.imagesToDownloadQueue = [];

            var type = this.map.getTileFileType();

            for(var zoom = min; zoom <= max; zoom++) {
                var bounds = this.map.getExtent();

                var txMin = this.easting2tile(bounds.left, zoom);
                var txMax = this.easting2tile(bounds.right, zoom);

                var tyMin = this.northing2tile(bounds.bottom, zoom);
                var tyMax = this.northing2tile(bounds.top, zoom);

                for (var tx = txMin; tx <= txMax; tx++) {
                    for (var ty = tyMin; ty <= tyMax; ty++) {
                        var url = this.map.baseMapFullURL + '/' + zoom + '/' + tx + '/' + ty  + '.' + type;

                        var imageInfo = { url: url, zoom: zoom, tx:tx, ty:ty, type:type};
                        //var nextPos = this.imagesToDownloadQueue.length;
                        this.imagesToDownloadQueue.push(imageInfo);

                    }
                }
            }

            var downloadImageThreads = 8;
            //console.debug(imagesToDownloadQueue.length + " to download");


            for(var i=0; i < downloadImageThreads; i++){
                this.saveImageSynchronous(mapName);
            }

            this.setSavedMapDetails(mapName, details);
        }
        else{
            Utils.inform(name + ' is already defined');
            success = false;
        }


    }

    return success;
};



/**
 * Save image to cache using HTML5 canvas.
 * @param url Remote image URL.
 */
Cache.prototype.saveImage = function(url, zoom, tx, ty, type, mapName){


    // TODO - check if image has been previously downloaded
    var img = new Image()
    img.src = url;

    img.onload = $.proxy(function(event){
        var canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(event.target, 0, 0);

        this.downloadComplete($(event.target).attr('src'), canvas.toDataURL(), tx, ty, zoom, mapName);
    }, this);
};


/**
 * Save images synchronously
 */
Cache.prototype.saveImageSynchronous = function(mapName){
    if(this.imagesToDownloadQueue.length !== 0){
        var imageInfo = this.imagesToDownloadQueue.pop();
        if(imageInfo){
            this.saveImage(imageInfo.url,
                           imageInfo.zoom,
                           imageInfo.tx,
                           imageInfo.ty,
                           imageInfo.type,
                           mapName);
        }
    }

};


/**
 * Single image download is complete.
 * @param url Remote Image URL.
 * @param value Local Image.
 */
Cache.prototype.downloadComplete = function(url, tileData, x, y, z, mapName){

    ++this.count;

    var percent = ((this.count / this.noOfTiles) * 100).toFixed(0);

    $.mobile.loading( 'show', { text: percent  + '%'});
    if(this.count === this.noOfTiles){
        $.mobile.hidePageLoadingMsg();
    }
    var that = this;
    var callback = function (){   //get the next image
        that.saveImageSynchronous(mapName);
    }
    if(url){

        webdb.insertCachedTilePath(x, y, z, tileData, mapName, callback);

    }


};

/**
 * Count number of tile to cache.
 * @param min Start zoom level.
 * @param max End zoom level.
 */
Cache.prototype.totalNumberOfTilesToDownload = function(min, max){
    var totalTileToDownload = 0;

    var bounds = this.map.getExtent();
    if(bounds !== null){
        for (var zoom = min; zoom <= max; zoom++){
            var txMin = this.easting2tile(bounds.left, zoom);
            var txMax = this.easting2tile(bounds.right, zoom);

            var tyMin = this.northing2tile(bounds.bottom, zoom);
            var tyMax = this.northing2tile(bounds.top, zoom);

            var ntx = txMax - txMin + 1;
            var nty = tyMax - tyMin + 1;

            totalTileToDownload += Math.abs((ntx * nty));
        }
    }
    else{
        console.warn("Map has no bounds, can't calculate download size");
    }

    return totalTileToDownload;
};

/**
 * Convert longitude to TMS tile number.
 * @param lon
 * @param zoom
 * @return Tile number.
 */
Cache.prototype.long2tile = function(lon, zoom){
    return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
};

/**
 * Convert easting to TMS tile number.
 * @param eastings
 * @param zoom
 * @return Tile number.
 */
Cache.prototype.easting2tile = function(easting, zoom){
    var tn;
    var caps = this.map.getTileMapCapabilities();
    if(caps.tileFormat){
        tn = Math.floor(easting / (caps.tileFormat.width * caps.tileSet[zoom]));
    }

    return tn
};

/**
 * Convert latitude to TMS tile number.
 * @param lat
 * @param zoom
 * @return Tile number.
 */
Cache.prototype.lat2tile = function(lat, zoom)  {
    return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
};

/**
 * Convert northing to TMS tile number.
 * @param northing
 * @param zoom
 * @return Tile number.
 */
Cache.prototype.northing2tile = function(northing, zoom){
    var tn;
    var caps = this.map.getTileMapCapabilities();
    if(caps.tileFormat){
        tn = Math.floor(northing / (caps.tileFormat.height * caps.tileSet[zoom]));
    }

    return tn;
};

/**
 * Update cache page stats.
 * @param min minimum zoom level
 * @param max maximum zoom level
 */
Cache.prototype.setSaveStats = function(min, max){
    var count = this.totalNumberOfTilesToDownload(min, max);
    var downloadSize = count * Cache.AV_TILE_SIZE;

    $('#cache-save-details-text-stats').html(
        'Download Size: ' +
            Utils.bytesToSize(downloadSize) +
            ' (max ' + this.maxDownloadStr + ')');

    // disable download button if download is too big
    if(downloadSize > Cache.MAX_CACHE){
        $('#cache-save-details-button-div a').addClass('ui-disabled');
    }
    else{
        $('#cache-save-details-button-div a').removeClass('ui-disabled');
    }
};


var FileSystemCache = function(options){

    this.parent = new Cache(options);
    this.parent.urlPrefix = Map.MAP_URL;

    this.parent.saveImage = $.proxy(function(url, zoom, tx, ty, type, mapName){

        this.saveImage(url, zoom, tx, ty, type, mapName);
    }, this);


    this.parent.clearCache = $.proxy(function(callback){
        this.clearCache(callback);
    }, this);

    // create directory structure for caching
    //Changed to persistent cache for iphone3G issue with temp cache
    //http://community.phonegap.com/nitobi/topics/localfilesystem_persistent_and_ios_data_storage_guidelines
    Utils.getPersistentRoot($.proxy(function(dir){
        dir.getDirectory(
            "mapcache",
            {create: true, exclusive: false},
            $.proxy(function(cacheDir){
                this.parent.cacheDir = cacheDir;
                this.cacheDir = cacheDir;

                deviceDependent.preventGalleryScanning(cacheDir);
            }, this),
            function(){
                alert('Failed finding root directory. Caching will be disabled.');
            });
    }, this));

    return this.parent;
};

/**
 * Remove all cached tiles.
 */
FileSystemCache.prototype.clearCache = function(callback){
    this.parent.deleteCache(callback);
    this.cacheDir.createReader().readEntries(
        $.proxy(function(entries){
            for (var i = 0; i < entries.length; i++) {
                this.cacheDir.getFile(entries[i].name,
                                      {create: false, exclusive: false},
                                      function(file){
                                          file.remove();
                                      },
                                      function(error){
                                          console.error('Failed to delete image:' + error);
                                      });
            }
        }, this),
        function(error){
            alert('Problem reading cache directory: ' + error);
        }
    );
};

/**
 * Save image to sd card.
 * @param url External Tile URL.
 * @param zoom Map zoom level.
 * @param tx Tile xcoord.
 * @param ty Tile ycoord.
 * @param type Image file type.
 */
FileSystemCache.prototype.saveImage = function(url, zoom, tx, ty, type, mapName){
    var maxNumberOfFilesPerDir = 100;
    var fileName = this.parent.map.getStackType() +
        '_' + zoom + '_' + tx + '_' +  ty + '.' + type;

    var subDirectory = Math.ceil(this.parent.count / maxNumberOfFilesPerDir);

    var getLocalFileName = function(cacheDir, fileName){
        // remove file:// from cachedir fullpath

        var path = cacheDir.fullPath;
        if(path.slice(0,7) === "file://"){
            path = path.substr(7);
        }

        return path + "/"+ mapName +  "/" + subDirectory + "/" + fileName;
    };


    console.debug("download " + url);
    // no file, download it
    var fileTransfer = new FileTransfer();
    fileTransfer.download(
        url + Utils.getLoggingParams(true),
        getLocalFileName(this.cacheDir, fileName),
        $.proxy(function(entry) {

           this.parent.downloadComplete(url, getLocalFileName(this.cacheDir, fileName), tx, ty, zoom, mapName);
        }, this),
        $.proxy(function(error) {
            console.error("download error source " + error.source);
            console.error("download error target " + error.target);

            // error code 3? - check whitelist
            console.error("download error code: " + error.code);
            this.parent.downloadComplete();
        }, this)
    );

}