'use strict';
(function(window){
	var regex = /cityscope:\/\/.*pcapi=([^&]*)/;
	window.handleOpenURL = function(url){
		var result = regex.exec(url);
		if(typeof window.pcapi.setCloudProviderUrl === 'function'){
			if(result !== null){
				window.pcapi.setCloudProviderUrl(result[1]);
				$('.sync-download-button').click();
			}
		}
	};
})(window);