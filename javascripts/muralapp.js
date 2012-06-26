var Mural = {};

(function(m){
  m.App = function(options) {
    var defaultCenter = {};
    defaultCenter.lat = config.default_lat || 37.7749295;
    defaultCenter.lng = config.default_lng || -122.4194155;
    var _options = $.extend({
        mapTarget: '#map-target',
        listTarget: '#list-container',
        detailTarget: '#detail-container',
        detailHeader: '#detail-header',
        muralIcon: 'images/mosaic-marker.png',
        locationIcon: 'images/location-icon-pin-32.png',
        base_url: "http://data.honolulu.gov/api/resource/yef5-h88r.json"
    }, options),
    //Map Styles
    _mapTypeName = 'Map',
    _mapTypeDef = [{featureType: "road",elementType: "all",stylers: [{ saturation: -99 },{ hue: "#0000ff" }]},{featureType: "all",elementType: "labels",stylers: [{ visibility: "simplified" }]},{featureType: "road",elementType: "geometry",stylers: [{ visibility: "simplified" }]},{featureType: "road.local",elementType: "labels",stylers: [{ visibility: "on" }]},{featureType: "all",elementType: "geometry",stylers: [{ saturation: -20 }]}],
    _mapOptions = {
      zoom: 16,
      // PHL 39.95185, -75.16382  SF 37.7749295, -122.4194155
      center: new google.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
      mapTypeId: _mapTypeName,
      mapTypeControlOptions: {
         mapTypeIds: [_mapTypeName, google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.HYBRID]
      }
    },
    //Map objects
    _map,
    _markers = [],
    _lastSearchLatLng,
    _myLocationLatLng,
    _myLocationMarker,
    _infoWindow = new InfoBox(),
    _directionsService = new google.maps.DirectionsService(),
    //Mural cache
    _murals = [],
    _self = {};

    var _clearMarkers = function() {
        for(var i=0; i < _markers.length; i++) {
            _markers[i].setMap(null);
        }
        _markers = [];
    };

    var _addMarker = function(mural) {
        var latLng = new google.maps.LatLng(mural.latitude, mural.longitude);
        var marker = new google.maps.Marker({
            map: _map,
            position: latLng,
            icon: _options.muralIcon
        });
        _markers.push(marker);

        google.maps.event.addListener(marker, "click", function() {
            var thumbnail = mural.thumb || mural.imgs[0];
            // Build the html for our GMaps infoWindow
            var bubbleHtml = '';
            bubbleHtml += '<strong>'+mural.title+'</strong><br />';
            bubbleHtml += '<img class="thumbnail" src="'+thumbnail+'" />';
            bubbleHtml = '<div id="mid-'+mural.objectid+'" class="infoBubbs">'+bubbleHtml+'</div><br style="clear:both" />';

            // Evidently we need to create the div the old fashioned way
            // for the infoWindow.
            var bubbs = document.createElement("div");
            bubbs.className = 'bubbleWrap';
            bubbs.innerHTML = bubbleHtml;

            $(bubbs).find('.infoBubbs').bind('tap',function(ev) {
                // The id of the element is in the form mid-XX where XX is the assetId.
                var pieces = this.id.split('-');

                // Build our url
                var url = 'details.html?id='+pieces[1];

                // Manually change the page
                $.mobile.changePage(url);
            });

            var winContent = '<div class="win-content">' +
              '<div class="win-title">'+mural.title+'</div>' +
              '<img src="'+thumbnail+'" />' +
              '<a href="javascript:void(0);" data-assetid="'+mural.objectid+
                  '" class="win-details-link">More details...</a>' +
            '</div>';

            var newOffset = new google.maps.Size(-68,0,'px','px');
            var winOptions = {
                content: bubbs,
                enableEventPropagation: true,
                position: latLng,
                pixelOffset: newOffset,
                closeBoxMargin: '18px 8px 2px 2px'
            };

            _infoWindow.setOptions(winOptions);
            _infoWindow.open(_map, marker);

            $('.win-details-link').bind('tap',function(ev) {
                // Build our url
                var url = 'details.html?id='+$(this).attr('data-assetid');

                // Manually change the page
                $.mobile.changePage(url);
            });
        });
    };

    var _refreshMarkers = function(){
        _clearMarkers();
        _infoWindow.close();

        // Add points to the map
        $.each(_murals, function(i, mural){
            if(mural) {
                _addMarker(mural);
            }
        });
    };

    var calcDistance = function(mural, skip_echo) {
      skip_echo = skip_echo || false;
      var request = {
        origin:_myLocationLatLng,
        destination: new google.maps.LatLng(mural.latitude, mural.longitude),
        travelMode: google.maps.DirectionsTravelMode.WALKING
      };
      
      mural.distance = parseFloat(quickDist(_myLocationLatLng.lat(), _myLocationLatLng.lng(), mural.latitude, mural.longitude), 10);
//      if(!skip_echo) $('.mural-dist-'+mural.properties._id).text('You are ' + mural.distance + ' km away.');
      
      // _directionsService.route(request, function(result, status) {
      //         if (status == google.maps.DirectionsStatus.OK) {
      //           if(!skip_echo) $('.mural-dist-'+mural.properties._id).text('You are ' + result.routes[0].legs[0].distance.text + ' away.');
      //           mural.distance = parseFloat(result.routes[0].legs[0].distance.text, 10);
      //         }
      //       });
    };

    // http://www.movable-type.co.uk/scripts/latlong.html
    var quickDist = function(lat1, lon1, lat2, lon2) {
      var R = 6371; // km
      var d = Math.acos(Math.sin(lat1)*Math.sin(lat2) +
                        Math.cos(lat1)*Math.cos(lat2) *
                        Math.cos(lon2-lon1)) * R;
      return d;
    };


    var _refreshDetailList = function() {
      var $list = $(_options.listTarget).empty(),
        html = '<ul id="artlisting" data-role="listview" data-inset="true" data-theme="d">';

      $.each(_murals, function(i, mural){
          var thumbnail = mural.thumb || mural.imgs[0];
          html += '<li><img class="thumbnail" src="'+thumbnail+'" alt="'+mural.title + '" class="ul-li-icon">' +
              '<a href="details.html?id='+ mural.objectid +'">' + mural.title + '</a>';

          if (_myLocationLatLng) {
            html += '<div class="mural-dist-'+mural.objectid + ' distance"></div>';
          }
          html += '</li>';
      });
      html += '</ul>';
      $list.html(html);


      if (_myLocationLatLng) {
        $.each(_murals, function(i, mural) {
          calcDistance(mural);
        });
      }
      $list.find('ul').listview();
    };

    // Where are we?
    _self.findMe = function() {

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition( function(position) {
                var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

                //Clear the marker if it exists
                if(_myLocationMarker) {
                  _myLocationMarker.setMap(null);
                }

                _myLocationLatLng = latLng;

                //Add a marker on my current location
                _myLocationMarker = new google.maps.Marker({
                    map: _map,
                    position: _myLocationLatLng,
                    icon: _options.locationIcon
                });

                _map.setCenter(_myLocationLatLng);
                _self.refresh(_myLocationLatLng);

            },
            function(msg){
              alert('We couldn\'t locate your position.');
            },
            { enableHighAccuracy: true, maximumAge: 90000 });
        }
    };

    _self.refresh = function(latLng) {
        var ajaxUrl;
        // Figure out the bounding box for the query
        var f = 0.015;
        latLng = latLng || _lastSearchLatLng || _map.getCenter();
        bbox = {'minx': (latLng.lng()-f),
                'miny': (latLng.lat()-f),
                'maxx': (latLng.lng()+f),
                'maxy': (latLng.lat()+f)
        };

        _lastSearchLatLng = latLng;

        // "Where da art at?" she ajaxed the couch.
        $.ajax({
            url: _options.base_url,
            data:{"$where": "longitude > "+bbox.minx+' AND latitude > '+bbox.miny+' AND longitude < '+bbox.maxx+' AND latitude <'+bbox.maxy},
            crossDomain: true,
            dataType: 'jsonp',
            jsonp: "jsonp",
            success: function (data, textStatus, jqXHR) {
                var imgArray, i;
                _murals = data;

                // Normalize our images & add distances
                $.each(_murals, function(idx, mural) {
                    setImages(mural);
                    if(_myLocationLatLng) {
                      mural.distance = quickDist(_myLocationLatLng.lat(), _myLocationLatLng.lng(), mural.latitude, mural.longitude);
                    } else {
                      mural.distance = 0;
                    }
                });

                // Sort the murals from closest to farthest
                function compareDist(a, b) { return  a.distance - b.distance; }
                _murals.sort(function(a, b) { return  a.distance - b.distance; });

                // Only keep the closest 50
                _murals = _murals.slice(0,50);

                // Update the map markers and the listing page
                _refreshMarkers();
                _refreshDetailList();
            }
        });
    };

    var _initMap = function() {
        _map = new google.maps.Map($(_options.mapTarget).get(0), _mapOptions);

        var mapType = new google.maps.StyledMapType(_mapTypeDef, { name: _mapTypeName});

        _map.mapTypes.set(_mapTypeName, mapType);
        _map.setMapTypeId(_mapTypeName);

        google.maps.event.addListener(_map, 'dragend', function() {
            _self.refresh(_map.getCenter());
        });
    };

    var _initFindMe = function() {
      $('.find-me').live('click', function(){
          _self.findMe();
      });
    };

    //Init the app
    _initMap();
    _initFindMe();
    _self.findMe();

    return _self;
  };
})(Mural);

//Go go go go go!!
var app, config;
$('#map-page').live('pagecreate',function(event){
    loadConfig(function(c) {
      config = c;
      $('#city_name').text(config.city_name);
      $('#brought_to_you_by').text(config.brought_to_you_by);
      app = app || Mural.App();
      $('#about-page').show().delay(3000).fadeOut();
    });
});

var loadConfig = function(callback) {

    var data = {default_lat: 21.30694,
            default_lng: -157.85833,
            city_name: "Honolulu",
            brought_to_you_by: "Mayor's Office of Culture and the Arts.",
            base_url:"http://data.honolulu.gov/api/resource/yef5-h88r.json"};

    callback(data);
};

// Setup the images for a given piece of art
var setImages = function (mural) {
    mural.imgs = [];
    mural.thumb = mural.thumb || null;
    var thumbbits = [];
    if(mural.imagefile) {               // Using image_urls
        mural.imgs = [mural.imagefile];
        // A little hack to make use of our s3-hosted thumbnails
        if(mural.imgs[0].indexOf('publicartimages.s3') > -1) {
          thumbbits = mural.image_urls[0].split('/');
          thumbbits[thumbbits.length-1] = 'thumb_'+thumbbits[thumbbits.length-1];
          mural.thumb = thumbbits.join('/');
          thumbbits = mural.thumb.split('.');
          thumbbits[thumbbits.length-1] = thumbbits[thumbbits.length-1].toLowerCase();
          mural.thumb = thumbbits.join('.');
        }
    } else if(mural._attachments) {      // Using attachments
        imgArray = getKeys(mural._attachments);
        for(i=0; i < imgArray.length; i+=1) {
            mural.imgs.push('/dbimgs/'+mural._id+'/'+imgArray[i]);
        }
    } else {                                        // No image :(
        mural.imgs.push('images/noimage.png');
    }
    return mural;
};

// Helper function that returns all the keys for a given object
var getKeys = function(obj){
    var keys = [];
    for(var key in obj){
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
};