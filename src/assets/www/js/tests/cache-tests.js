

var cacheTests = {
        MAP_NAME :"name-name"
      ,
     runTests : function(ui) {
    
       module("Cache Tests");

        
         
         test("Delete Map", function(){
            expect( 2 );
            var success = true;
            ui.cache.deleteSavedMapDetails(cacheTests.MAP_NAME);
            stop();
            setTimeout(function(){
                ok(success, "Database Map Deleted");
                //check local storage
                
               var maps = ui.cache.getSavedMaps() || {};
               
               ok(!(maps[cacheTests.MAP_NAME]), "Map should not be in localStorage" );
                start();
            },2000);
            
         
         });
       

        
         test( "Download North edinburgh test", function() {
            expect(3);
            
         
            //bottom: 676321.01823658
            //left: 322499.99340785
            //right: 323715.99340785
            //top: 677925.01823658
           
            var bounds = new OpenLayers.Bounds(322499.99340785,676321.01823658,323715.99340785,677925.01823658);
            //first map is container
            ui.map.map.zoomToExtent(bounds);
            
            ui.cache.saveMap(cacheTests.MAP_NAME, 8, 9);
            
            stop();
            setTimeout(function(){
                var url ='';
                var tileExists = false;
                
                function fileExists(fileEntry){
                    console.log("File " + fileEntry.fullPath + " exists!");
                    tileExists = true;
                }
                function fileDoesNotExist(){
                    console.log("file does not exist");
                }
                function getFSFail(evt) {
                    console.log(evt.target.error.code);
                }
                
                function checkIfFileExists(path){
                    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0,
                    function(fileSystem){
                        fileSystem.root.getFile(path, { create: false }, fileExists, fileDoesNotExist);
                    },
                     getFSFail); //of requestFileSystem
                }
                var callback = function(fileLocation){
                    url = fileLocation;
                    
                    
                    console.log(fileLocation);
                    checkIfFileExists(fileLocation);
                }
                
                
                
                //webdb.selectAllUrls();
                webdb.getCachedTilePath(callback, null, 316,661, 8, 'dummyUrl');
                
                
                setTimeout( function() {
                 var maps = ui.cache.getSavedMaps();
                 ok((maps[cacheTests.MAP_NAME]), "Map should  be in localStorage" );
                    ok(url.indexOf('edina/cache/name-name/1/open_8_316_661.jpg') !== -1, 'Tile Stored in correct directory');
                    ok(tileExists === true, "Actual tile stored in phone directory");
               
                    start();
                } ,2000);
                
            },2000)

            
        });
        
        


  
         test('create local storage cache object', function (){

            var db = new Storage();
            var settings = new Settings({db: db});
             Utils = initUtils(false, settings);
             var map = new Map({db: db, isMobileApp: false});
             var     cache = new Cache({map: map, db: db});
                ok( cache !== undefined, 'Cache should be defined'); 
            }
        );

        test('create filebased cache object', function (){

            var db = new Storage();
            var settings = new Settings({db: db});
             Utils = initUtils(false, settings);
            var map = new Map({db: db, isMobileApp: false});
            var cache = new FileSystemCache({map: map, db: db});
                ok( cache !== undefined, 'FileSystemCache should be defined'); 
            }
        );
        
        //display the results in a different div.
        setTimeout(function(){
            //put results 
            $('#my-qunit-testresult').html( $('#qunit-testresult').html());
        },10000);

        

    }

    
    

};




