"use strict";

var webdb = {};

webdb.DATABASE_CREATED = "false";

function getWebDatabase(){
    if(typeof(openDatabase) !== 'undefined'){
        if(!webdb.db){
            webdb.open();
        }
    }
    else{
        webdb = undefined;
    }

    return webdb;
}




webdb.open = function() {
  var dbSize = 10 * 1024 * 1024; // 10MB
  webdb.db = openDatabase("webDbCache", "1.0", "Cached Tiles", dbSize);
}

webdb.onError = function(tx, e) {
  console.warn("There has been an error: " + e.message);
}

webdb.onSuccess = function(tx, r) {
  localStorage.setItem(webdb.DATABASE_CREATED, "true");
}

webdb.createTablesIfRequired = function() {
    console.log("Creating DataBase Tables");
  var db = webdb.db;
  db.transaction(function(tx) {
    tx.executeSql("CREATE TABLE IF NOT EXISTS " +
                  "tiles(zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data TEXT, mapName TEXT)", [], webdb.onSuccess,
            webdb.onError);

    tx.executeSql("CREATE UNIQUE INDEX  IF NOT EXISTS " +
                  " tile_index on tiles(zoom_level, tile_column, tile_row, mapName)", [], webdb.onSuccess,
            webdb.onError);

  });
}





webdb.deleteMap = function(mapName, callback){

    var db = webdb.db;

    var success = function (tx, rs){

        if(callback){
            callback(true);
        }
    }
    var error = function (tx,e){
        console.log("error DELETING MAP");
        console.log(e);
    }
    db.transaction(function(tx) {
    console.log("Delete mapname  " + mapName);
                tx.executeSql("DELETE FROM tiles WHERE mapName=?",
            [ mapName],
            success,
            error
        );

    });


}


webdb.insertCachedTilePath = function(x, y, z, tileData, mapName, callback){
    var db = webdb.db;

    var success = function (tx, rs){

        if(callback){
            callback();
        }
    }
    var error = function (tx,e){
        console.log("error");
        console.log(e.message);
        if(callback){
            callback();
        }
    }
    db.transaction(function(tx) {
       // console.log(' [urlKey, tilepath, mapName]' + urlKey + ', ' + tilepath + ', ' + mapName);
         tx.executeSql("INSERT INTO tiles(zoom_level, tile_column, tile_row, tile_data, mapName) VALUES (?,?,?,?,?)",
            [z, x, y, tileData, mapName],
            success,
            error
        );

    });


}

function hexToBase64(str) {
    return window.btoa(String.fromCharCode.apply(null, str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" ")));
}


webdb.getCachedTilePath = function(callback, scope, x, y, z, url ){
    
    var db = webdb.db;

    var resultsCallback = function(tx, rs) {


        if(callback) {
            if( rs.rows.length > 0 ) {

                var rowOutput  = rs.rows.item(0);

                callback.call(scope,rowOutput['tile_data']);

            } else {
                callback.call(scope, url);
            }
        }

    }
    db.transaction(function(tx) {

        tx.executeSql("SELECT tile_data FROM tiles where zoom_level=? AND tile_column=? AND tile_row=?", [z,x,y], resultsCallback,
            webdb.onError);
    });



}

webdb.saveCachedTile= function(actualUrl, storedUrl){
    var db = webdb.db;

    var id = webdb.getUrl();


    db.transaction(function(tx) {

        tx.executeSql("SELECT * FROM urls where url=?", [url], resultsCallback,
            webdb.onError);
    });

}


