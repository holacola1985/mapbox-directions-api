;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

if (!L.mapbox) throw new Error('include mapbox.js before mapbox.directions.js');

L.mapbox.directionsAPI = require('./src/directions');

},{"./src/directions":5}],2:[function(require,module,exports){
function xhr(url, callback, cors) {
    var sent = false;

    if (typeof window.XMLHttpRequest === 'undefined') {
        return callback(Error('Browser not supported'));
    }

    if (typeof cors === 'undefined') {
        var m = url.match(/^\s*https?:\/\/[^\/]*/);
        cors = m && (m[0] !== location.protocol + '//' + location.domain +
                (location.port ? ':' + location.port : ''));
    }

    var x;

    function isSuccessful(status) {
        return status >= 200 && status < 300 || status === 304;
    }

    if (cors && (
        // IE7-9 Quirks & Compatibility
        typeof window.XDomainRequest === 'object' ||
        // IE9 Standards mode
        typeof window.XDomainRequest === 'function'
    )) {
        // IE8-10
        x = new window.XDomainRequest();

        // Ensure callback is never called synchronously, i.e., before
        // x.send() returns (this has been observed in the wild).
        // See https://github.com/mapbox/mapbox.js/issues/472
        var original = callback;
        callback = function() {
            if (sent) {
                original.apply(this, arguments);
            } else {
                var that = this, args = arguments;
                setTimeout(function() {
                    original.apply(that, args);
                }, 0);
            }
        }
    } else {
        x = new window.XMLHttpRequest();
    }

    function loaded() {
        if (
            // XDomainRequest
            x.status === undefined ||
            // modern browsers
            isSuccessful(x.status)) callback.call(x, null, x);
        else callback.call(x, x, null);
    }

    // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
    // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
    if ('onload' in x) {
        x.onload = loaded;
    } else {
        x.onreadystatechange = function readystate() {
            if (x.readyState === 4) {
                loaded();
            }
        };
    }

    // Call the callback with the XMLHttpRequest object as an error and prevent
    // it from ever being called again by reassigning it to `noop`
    x.onerror = function error(evt) {
        // XDomainRequest provides no evt parameter
        callback.call(this, evt || true, null);
        callback = function() { };
    };

    // IE9 must have onprogress be set to a unique function.
    x.onprogress = function() { };

    x.ontimeout = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    x.onabort = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    // GET is the only supported HTTP Verb by XDomainRequest and is the
    // only one supported here.
    x.open('GET', url, true);

    // Send the request. Sending data is not supported.
    x.send(null);
    sent = true;

    return x;
}

if (typeof module !== 'undefined') module.exports = xhr;

},{}],3:[function(require,module,exports){
var polyline = {};

// Based off of [the offical Google document](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
//
// Some parts from [this implementation](http://facstaff.unca.edu/mcmcclur/GoogleMaps/EncodePolyline/PolylineEncoder.js)
// by [Mark McClure](http://facstaff.unca.edu/mcmcclur/)

function encode(coordinate, factor) {
    coordinate = Math.round(coordinate * factor);
    coordinate <<= 1;
    if (coordinate < 0) {
        coordinate = ~coordinate;
    }
    var output = '';
    while (coordinate >= 0x20) {
        output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
        coordinate >>= 5;
    }
    output += String.fromCharCode(coordinate + 63);
    return output;
}

// This is adapted from the implementation in Project-OSRM
// https://github.com/DennisOSRM/Project-OSRM-Web/blob/master/WebContent/routing/OSRM.RoutingGeometry.js
polyline.decode = function(str, precision) {
    var index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision || 5);

    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {

        // Reset shift, result, and byte
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
};

polyline.encode = function(coordinates, precision) {
    if (!coordinates.length) return '';

    var factor = Math.pow(10, precision || 5),
        output = encode(coordinates[0][0], factor) + encode(coordinates[0][1], factor);

    for (var i = 1; i < coordinates.length; i++) {
        var a = coordinates[i], b = coordinates[i - 1];
        output += encode(a[0] - b[0], factor);
        output += encode(a[1] - b[1], factor);
    }

    return output;
};

if (typeof module !== undefined) module.exports = polyline;

},{}],4:[function(require,module,exports){
(function() {
  var slice = [].slice;

  function queue(parallelism) {
    var q,
        tasks = [],
        started = 0, // number of tasks that have been started (and perhaps finished)
        active = 0, // number of tasks currently being executed (started but not finished)
        remaining = 0, // number of tasks not yet finished
        popping, // inside a synchronous task callback?
        error = null,
        await = noop,
        all;

    if (!parallelism) parallelism = Infinity;

    function pop() {
      while (popping = started < tasks.length && active < parallelism) {
        var i = started++,
            t = tasks[i],
            a = slice.call(t, 1);
        a.push(callback(i));
        ++active;
        t[0].apply(null, a);
      }
    }

    function callback(i) {
      return function(e, r) {
        --active;
        if (error != null) return;
        if (e != null) {
          error = e; // ignore new tasks and squelch active callbacks
          started = remaining = NaN; // stop queued tasks from starting
          notify();
        } else {
          tasks[i] = r;
          if (--remaining) popping || pop();
          else notify();
        }
      };
    }

    function notify() {
      if (error != null) await(error);
      else if (all) await(error, tasks);
      else await.apply(null, [error].concat(tasks));
    }

    return q = {
      defer: function() {
        if (!error) {
          tasks.push(arguments);
          ++remaining;
          pop();
        }
        return q;
      },
      await: function(f) {
        await = f;
        all = false;
        if (!remaining) notify();
        return q;
      },
      awaitAll: function(f) {
        await = f;
        all = true;
        if (!remaining) notify();
        return q;
      }
    };
  }

  function noop() {}

  queue.version = "1.0.7";
  if (typeof define === "function" && define.amd) define(function() { return queue; });
  else if (typeof module === "object" && module.exports) module.exports = queue;
  else this.queue = queue;
})();

},{}],5:[function(require,module,exports){
'use strict';

var request = require('./request'),
    polyline = require('polyline'),
    queue = require('queue-async');

var Directions = L.Class.extend({
    includes: [L.Mixin.Events],

    options: {
        units: 'imperial'
    },

    statics: {
        URL_TEMPLATE: 'https://api.tiles.mapbox.com/v4/directions/{profile}/{waypoints}.json?instructions=html&geometry=polyline&access_token={token}',
        GEOCODER_TEMPLATE: 'https://api.tiles.mapbox.com/v4/geocode/mapbox.places/{query}.json?proximity={proximity}&access_token={token}'
    },

    initialize: function(options) {
        L.setOptions(this, options);
        this._waypoints = [];
    },

    getOrigin: function () {
        return this.origin;
    },

    getDestination: function () {
        return this.destination;
    },

    setOrigin: function (origin) {
        origin = this._normalizeWaypoint(origin);

        this.origin = origin;
        this.fire('origin', {origin: origin});

        if (!origin) {
            this._unload();
        }

        return this;
    },

    setDestination: function (destination) {
        destination = this._normalizeWaypoint(destination);

        this.destination = destination;
        this.fire('destination', {destination: destination});

        if (!destination) {
            this._unload();
        }

        return this;
    },

    getProfile: function() {
        return this.profile || this.options.profile || 'mapbox.driving';
    },

    setProfile: function (profile) {
        this.profile = profile;
        this.fire('profile', {profile: profile});
        return this;
    },

    getWaypoints: function() {
        return this._waypoints;
    },

    setWaypoints: function (waypoints) {
        this._waypoints = waypoints.map(this._normalizeWaypoint);
        return this;
    },

    addWaypoint: function (index, waypoint) {
        this._waypoints.splice(index, 0, this._normalizeWaypoint(waypoint));
        return this;
    },

    removeWaypoint: function (index) {
        this._waypoints.splice(index, 1);
        return this;
    },

    setWaypoint: function (index, waypoint) {
        this._waypoints[index] = this._normalizeWaypoint(waypoint);
        return this;
    },

    reverse: function () {
        var o = this.origin,
            d = this.destination;

        this.origin = d;
        this.destination = o;
        this._waypoints.reverse();

        this.fire('origin', {origin: this.origin})
            .fire('destination', {destination: this.destination});

        return this;
    },

    selectRoute: function (route) {
        this.fire('selectRoute', {route: route});
    },

    highlightRoute: function (route) {
        this.fire('highlightRoute', {route: route});
    },

    highlightStep: function (step) {
        this.fire('highlightStep', {step: step});
    },

    queryURL: function () {
        var template = Directions.URL_TEMPLATE,
            token = this.options.accessToken || L.mapbox.accessToken,
            profile = this.getProfile(),
            points = [this.origin].concat(this._waypoints).concat([this.destination]).map(function (point) {
                return point.geometry.coordinates;
            }).join(';');

        if (L.mapbox.feedback) {
            L.mapbox.feedback.record({directions: profile + ';' + points});
        }

        return L.Util.template(template, {
            token: token,
            profile: profile,
            waypoints: points
        });
    },

    queryable: function () {
        return this.getOrigin() && this.getDestination();
    },

    query: function (opts) {
        if (!opts) opts = {};
        if (!this.queryable()) return this;

        if (this._query) {
            this._query.abort();
        }

        if (this._requests && this._requests.length) this._requests.forEach(function(request) {
            request.abort();
        });
        this._requests = [];

        var q = queue();

        var pts = [this.origin, this.destination].concat(this._waypoints);
        for (var i in pts) {
            if (!pts[i].geometry.coordinates) {
                q.defer(L.bind(this._geocode, this), pts[i], opts.proximity);
            }
        }

        q.await(L.bind(function(err) {
            if (err) {
                return this.fire('error', {error: err.message});
            }

            this._query = request(this.queryURL(), L.bind(function (err, resp) {
                this._query = null;

                if (err) {
                    return this.fire('error', {error: err.message});
                }

                this.directions = resp;
                this.directions.routes.forEach(function (route) {
                    route.geometry = {
                        type: "LineString",
                        coordinates: polyline.decode(route.geometry, 6).map(function (c) { return c.reverse(); })
                    };
                });

                if (!this.origin.properties.name) {
                    this.origin = this.directions.origin;
                } else {
                    this.directions.origin = this.origin;
                }

                if (!this.destination.properties.name) {
                    this.destination = this.directions.destination;
                } else {
                    this.directions.destination = this.destination;
                }

                this.fire('load', this.directions);
            }, this), this);
        }, this));

        return this;
    },

    _geocode: function(waypoint, proximity, cb) {
        if (!this._requests) this._requests = [];
        this._requests.push(request(L.Util.template(Directions.GEOCODER_TEMPLATE, {
            query: waypoint.properties.query,
            token: this.options.accessToken || L.mapbox.accessToken,
            proximity: proximity ? [proximity.lng, proximity.lat].join(',') : ''
        }), L.bind(function (err, resp) {
            if (err) {
                return cb(err);
            }

            if (!resp.features || !resp.features.length) {
                return cb(new Error("No results found for query " + waypoint.properties.query));
            }

            waypoint.geometry.coordinates = resp.features[0].center;
            waypoint.properties.name = resp.features[0].place_name;

            return cb();
        }, this)));
    },

    _unload: function () {
        this._waypoints = [];
        delete this.directions;
        this.fire('unload');
    },

    _normalizeWaypoint: function (waypoint) {
        if (!waypoint || waypoint.type === 'Feature') {
            return waypoint;
        }

        var coordinates,
            properties = {};

        if (waypoint instanceof L.LatLng) {
            waypoint = waypoint.wrap();
            coordinates = properties.query = [waypoint.lng, waypoint.lat];
        } else if (waypoint instanceof Array) {
            coordinates = properties.query = [waypoint[1], waypoint[0]];
        } else if (typeof waypoint === 'string') {
            properties.query = waypoint;
        }

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coordinates
            },
            properties: properties
        };
    }
});

module.exports = function(options) {
    return new Directions(options);
};

},{"./request":6,"polyline":3,"queue-async":4}],6:[function(require,module,exports){
'use strict';

var corslite = require('corslite');

module.exports = function(url, callback) {
    return corslite(url, function (err, resp) {
        if (err && err.type === 'abort') {
            return;
        }

        if (err && !err.responseText) {
            return callback(err);
        }

        resp = resp || err;

        try {
            resp = JSON.parse(resp.responseText);
        } catch (e) {
            return callback(new Error(resp.responseText));
        }

        if (resp.error) {
            return callback(new Error(resp.error));
        }

        return callback(null, resp);
    });
};

},{"corslite":2}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qZXJvbWUvTGlnaHRTdHJlYW0vZGV2L2xpYnMvbWFwYm94LWRpcmVjdGlvbnMtYXBpL2luZGV4LmpzIiwiL1VzZXJzL2plcm9tZS9MaWdodFN0cmVhbS9kZXYvbGlicy9tYXBib3gtZGlyZWN0aW9ucy1hcGkvbm9kZV9tb2R1bGVzL2NvcnNsaXRlL2NvcnNsaXRlLmpzIiwiL1VzZXJzL2plcm9tZS9MaWdodFN0cmVhbS9kZXYvbGlicy9tYXBib3gtZGlyZWN0aW9ucy1hcGkvbm9kZV9tb2R1bGVzL3BvbHlsaW5lL3NyYy9wb2x5bGluZS5qcyIsIi9Vc2Vycy9qZXJvbWUvTGlnaHRTdHJlYW0vZGV2L2xpYnMvbWFwYm94LWRpcmVjdGlvbnMtYXBpL25vZGVfbW9kdWxlcy9xdWV1ZS1hc3luYy9xdWV1ZS5qcyIsIi9Vc2Vycy9qZXJvbWUvTGlnaHRTdHJlYW0vZGV2L2xpYnMvbWFwYm94LWRpcmVjdGlvbnMtYXBpL3NyYy9kaXJlY3Rpb25zLmpzIiwiL1VzZXJzL2plcm9tZS9MaWdodFN0cmVhbS9kZXYvbGlicy9tYXBib3gtZGlyZWN0aW9ucy1hcGkvc3JjL3JlcXVlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuaWYgKCFMLm1hcGJveCkgdGhyb3cgbmV3IEVycm9yKCdpbmNsdWRlIG1hcGJveC5qcyBiZWZvcmUgbWFwYm94LmRpcmVjdGlvbnMuanMnKTtcblxuTC5tYXBib3guZGlyZWN0aW9uc0FQSSA9IHJlcXVpcmUoJy4vc3JjL2RpcmVjdGlvbnMnKTtcbiIsImZ1bmN0aW9uIHhocih1cmwsIGNhbGxiYWNrLCBjb3JzKSB7XG4gICAgdmFyIHNlbnQgPSBmYWxzZTtcblxuICAgIGlmICh0eXBlb2Ygd2luZG93LlhNTEh0dHBSZXF1ZXN0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soRXJyb3IoJ0Jyb3dzZXIgbm90IHN1cHBvcnRlZCcpKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGNvcnMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBtID0gdXJsLm1hdGNoKC9eXFxzKmh0dHBzPzpcXC9cXC9bXlxcL10qLyk7XG4gICAgICAgIGNvcnMgPSBtICYmIChtWzBdICE9PSBsb2NhdGlvbi5wcm90b2NvbCArICcvLycgKyBsb2NhdGlvbi5kb21haW4gK1xuICAgICAgICAgICAgICAgIChsb2NhdGlvbi5wb3J0ID8gJzonICsgbG9jYXRpb24ucG9ydCA6ICcnKSk7XG4gICAgfVxuXG4gICAgdmFyIHg7XG5cbiAgICBmdW5jdGlvbiBpc1N1Y2Nlc3NmdWwoc3RhdHVzKSB7XG4gICAgICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCB8fCBzdGF0dXMgPT09IDMwNDtcbiAgICB9XG5cbiAgICBpZiAoY29ycyAmJiAoXG4gICAgICAgIC8vIElFNy05IFF1aXJrcyAmIENvbXBhdGliaWxpdHlcbiAgICAgICAgdHlwZW9mIHdpbmRvdy5YRG9tYWluUmVxdWVzdCA9PT0gJ29iamVjdCcgfHxcbiAgICAgICAgLy8gSUU5IFN0YW5kYXJkcyBtb2RlXG4gICAgICAgIHR5cGVvZiB3aW5kb3cuWERvbWFpblJlcXVlc3QgPT09ICdmdW5jdGlvbidcbiAgICApKSB7XG4gICAgICAgIC8vIElFOC0xMFxuICAgICAgICB4ID0gbmV3IHdpbmRvdy5YRG9tYWluUmVxdWVzdCgpO1xuXG4gICAgICAgIC8vIEVuc3VyZSBjYWxsYmFjayBpcyBuZXZlciBjYWxsZWQgc3luY2hyb25vdXNseSwgaS5lLiwgYmVmb3JlXG4gICAgICAgIC8vIHguc2VuZCgpIHJldHVybnMgKHRoaXMgaGFzIGJlZW4gb2JzZXJ2ZWQgaW4gdGhlIHdpbGQpLlxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21hcGJveC9tYXBib3guanMvaXNzdWVzLzQ3MlxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBjYWxsYmFjaztcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChzZW50KSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsLmFwcGx5KHRoYXQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgeCA9IG5ldyB3aW5kb3cuWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkZWQoKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIC8vIFhEb21haW5SZXF1ZXN0XG4gICAgICAgICAgICB4LnN0YXR1cyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgICAgIGlzU3VjY2Vzc2Z1bCh4LnN0YXR1cykpIGNhbGxiYWNrLmNhbGwoeCwgbnVsbCwgeCk7XG4gICAgICAgIGVsc2UgY2FsbGJhY2suY2FsbCh4LCB4LCBudWxsKTtcbiAgICB9XG5cbiAgICAvLyBCb3RoIGBvbnJlYWR5c3RhdGVjaGFuZ2VgIGFuZCBgb25sb2FkYCBjYW4gZmlyZS4gYG9ucmVhZHlzdGF0ZWNoYW5nZWBcbiAgICAvLyBoYXMgW2JlZW4gc3VwcG9ydGVkIGZvciBsb25nZXJdKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzkxODE1MDgvMjI5MDAxKS5cbiAgICBpZiAoJ29ubG9hZCcgaW4geCkge1xuICAgICAgICB4Lm9ubG9hZCA9IGxvYWRlZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICB4Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uIHJlYWR5c3RhdGUoKSB7XG4gICAgICAgICAgICBpZiAoeC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgWE1MSHR0cFJlcXVlc3Qgb2JqZWN0IGFzIGFuIGVycm9yIGFuZCBwcmV2ZW50XG4gICAgLy8gaXQgZnJvbSBldmVyIGJlaW5nIGNhbGxlZCBhZ2FpbiBieSByZWFzc2lnbmluZyBpdCB0byBgbm9vcGBcbiAgICB4Lm9uZXJyb3IgPSBmdW5jdGlvbiBlcnJvcihldnQpIHtcbiAgICAgICAgLy8gWERvbWFpblJlcXVlc3QgcHJvdmlkZXMgbm8gZXZ0IHBhcmFtZXRlclxuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIGV2dCB8fCB0cnVlLCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgLy8gSUU5IG11c3QgaGF2ZSBvbnByb2dyZXNzIGJlIHNldCB0byBhIHVuaXF1ZSBmdW5jdGlvbi5cbiAgICB4Lm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHsgfTtcblxuICAgIHgub250aW1lb3V0ID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgZXZ0LCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgeC5vbmFib3J0ID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgZXZ0LCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgLy8gR0VUIGlzIHRoZSBvbmx5IHN1cHBvcnRlZCBIVFRQIFZlcmIgYnkgWERvbWFpblJlcXVlc3QgYW5kIGlzIHRoZVxuICAgIC8vIG9ubHkgb25lIHN1cHBvcnRlZCBoZXJlLlxuICAgIHgub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgIC8vIFNlbmQgdGhlIHJlcXVlc3QuIFNlbmRpbmcgZGF0YSBpcyBub3Qgc3VwcG9ydGVkLlxuICAgIHguc2VuZChudWxsKTtcbiAgICBzZW50ID0gdHJ1ZTtcblxuICAgIHJldHVybiB4O1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIG1vZHVsZS5leHBvcnRzID0geGhyO1xuIiwidmFyIHBvbHlsaW5lID0ge307XG5cbi8vIEJhc2VkIG9mZiBvZiBbdGhlIG9mZmljYWwgR29vZ2xlIGRvY3VtZW50XShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS9tYXBzL2RvY3VtZW50YXRpb24vdXRpbGl0aWVzL3BvbHlsaW5lYWxnb3JpdGhtKVxuLy9cbi8vIFNvbWUgcGFydHMgZnJvbSBbdGhpcyBpbXBsZW1lbnRhdGlvbl0oaHR0cDovL2ZhY3N0YWZmLnVuY2EuZWR1L21jbWNjbHVyL0dvb2dsZU1hcHMvRW5jb2RlUG9seWxpbmUvUG9seWxpbmVFbmNvZGVyLmpzKVxuLy8gYnkgW01hcmsgTWNDbHVyZV0oaHR0cDovL2ZhY3N0YWZmLnVuY2EuZWR1L21jbWNjbHVyLylcblxuZnVuY3Rpb24gZW5jb2RlKGNvb3JkaW5hdGUsIGZhY3Rvcikge1xuICAgIGNvb3JkaW5hdGUgPSBNYXRoLnJvdW5kKGNvb3JkaW5hdGUgKiBmYWN0b3IpO1xuICAgIGNvb3JkaW5hdGUgPDw9IDE7XG4gICAgaWYgKGNvb3JkaW5hdGUgPCAwKSB7XG4gICAgICAgIGNvb3JkaW5hdGUgPSB+Y29vcmRpbmF0ZTtcbiAgICB9XG4gICAgdmFyIG91dHB1dCA9ICcnO1xuICAgIHdoaWxlIChjb29yZGluYXRlID49IDB4MjApIHtcbiAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKDB4MjAgfCAoY29vcmRpbmF0ZSAmIDB4MWYpKSArIDYzKTtcbiAgICAgICAgY29vcmRpbmF0ZSA+Pj0gNTtcbiAgICB9XG4gICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY29vcmRpbmF0ZSArIDYzKTtcbiAgICByZXR1cm4gb3V0cHV0O1xufVxuXG4vLyBUaGlzIGlzIGFkYXB0ZWQgZnJvbSB0aGUgaW1wbGVtZW50YXRpb24gaW4gUHJvamVjdC1PU1JNXG4vLyBodHRwczovL2dpdGh1Yi5jb20vRGVubmlzT1NSTS9Qcm9qZWN0LU9TUk0tV2ViL2Jsb2IvbWFzdGVyL1dlYkNvbnRlbnQvcm91dGluZy9PU1JNLlJvdXRpbmdHZW9tZXRyeS5qc1xucG9seWxpbmUuZGVjb2RlID0gZnVuY3Rpb24oc3RyLCBwcmVjaXNpb24pIHtcbiAgICB2YXIgaW5kZXggPSAwLFxuICAgICAgICBsYXQgPSAwLFxuICAgICAgICBsbmcgPSAwLFxuICAgICAgICBjb29yZGluYXRlcyA9IFtdLFxuICAgICAgICBzaGlmdCA9IDAsXG4gICAgICAgIHJlc3VsdCA9IDAsXG4gICAgICAgIGJ5dGUgPSBudWxsLFxuICAgICAgICBsYXRpdHVkZV9jaGFuZ2UsXG4gICAgICAgIGxvbmdpdHVkZV9jaGFuZ2UsXG4gICAgICAgIGZhY3RvciA9IE1hdGgucG93KDEwLCBwcmVjaXNpb24gfHwgNSk7XG5cbiAgICAvLyBDb29yZGluYXRlcyBoYXZlIHZhcmlhYmxlIGxlbmd0aCB3aGVuIGVuY29kZWQsIHNvIGp1c3Qga2VlcFxuICAgIC8vIHRyYWNrIG9mIHdoZXRoZXIgd2UndmUgaGl0IHRoZSBlbmQgb2YgdGhlIHN0cmluZy4gSW4gZWFjaFxuICAgIC8vIGxvb3AgaXRlcmF0aW9uLCBhIHNpbmdsZSBjb29yZGluYXRlIGlzIGRlY29kZWQuXG4gICAgd2hpbGUgKGluZGV4IDwgc3RyLmxlbmd0aCkge1xuXG4gICAgICAgIC8vIFJlc2V0IHNoaWZ0LCByZXN1bHQsIGFuZCBieXRlXG4gICAgICAgIGJ5dGUgPSBudWxsO1xuICAgICAgICBzaGlmdCA9IDA7XG4gICAgICAgIHJlc3VsdCA9IDA7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgYnl0ZSA9IHN0ci5jaGFyQ29kZUF0KGluZGV4KyspIC0gNjM7XG4gICAgICAgICAgICByZXN1bHQgfD0gKGJ5dGUgJiAweDFmKSA8PCBzaGlmdDtcbiAgICAgICAgICAgIHNoaWZ0ICs9IDU7XG4gICAgICAgIH0gd2hpbGUgKGJ5dGUgPj0gMHgyMCk7XG5cbiAgICAgICAgbGF0aXR1ZGVfY2hhbmdlID0gKChyZXN1bHQgJiAxKSA/IH4ocmVzdWx0ID4+IDEpIDogKHJlc3VsdCA+PiAxKSk7XG5cbiAgICAgICAgc2hpZnQgPSByZXN1bHQgPSAwO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGJ5dGUgPSBzdHIuY2hhckNvZGVBdChpbmRleCsrKSAtIDYzO1xuICAgICAgICAgICAgcmVzdWx0IHw9IChieXRlICYgMHgxZikgPDwgc2hpZnQ7XG4gICAgICAgICAgICBzaGlmdCArPSA1O1xuICAgICAgICB9IHdoaWxlIChieXRlID49IDB4MjApO1xuXG4gICAgICAgIGxvbmdpdHVkZV9jaGFuZ2UgPSAoKHJlc3VsdCAmIDEpID8gfihyZXN1bHQgPj4gMSkgOiAocmVzdWx0ID4+IDEpKTtcblxuICAgICAgICBsYXQgKz0gbGF0aXR1ZGVfY2hhbmdlO1xuICAgICAgICBsbmcgKz0gbG9uZ2l0dWRlX2NoYW5nZTtcblxuICAgICAgICBjb29yZGluYXRlcy5wdXNoKFtsYXQgLyBmYWN0b3IsIGxuZyAvIGZhY3Rvcl0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb29yZGluYXRlcztcbn07XG5cbnBvbHlsaW5lLmVuY29kZSA9IGZ1bmN0aW9uKGNvb3JkaW5hdGVzLCBwcmVjaXNpb24pIHtcbiAgICBpZiAoIWNvb3JkaW5hdGVzLmxlbmd0aCkgcmV0dXJuICcnO1xuXG4gICAgdmFyIGZhY3RvciA9IE1hdGgucG93KDEwLCBwcmVjaXNpb24gfHwgNSksXG4gICAgICAgIG91dHB1dCA9IGVuY29kZShjb29yZGluYXRlc1swXVswXSwgZmFjdG9yKSArIGVuY29kZShjb29yZGluYXRlc1swXVsxXSwgZmFjdG9yKTtcblxuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGEgPSBjb29yZGluYXRlc1tpXSwgYiA9IGNvb3JkaW5hdGVzW2kgLSAxXTtcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZShhWzBdIC0gYlswXSwgZmFjdG9yKTtcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZShhWzFdIC0gYlsxXSwgZmFjdG9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3V0cHV0O1xufTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09IHVuZGVmaW5lZCkgbW9kdWxlLmV4cG9ydHMgPSBwb2x5bGluZTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIHNsaWNlID0gW10uc2xpY2U7XG5cbiAgZnVuY3Rpb24gcXVldWUocGFyYWxsZWxpc20pIHtcbiAgICB2YXIgcSxcbiAgICAgICAgdGFza3MgPSBbXSxcbiAgICAgICAgc3RhcnRlZCA9IDAsIC8vIG51bWJlciBvZiB0YXNrcyB0aGF0IGhhdmUgYmVlbiBzdGFydGVkIChhbmQgcGVyaGFwcyBmaW5pc2hlZClcbiAgICAgICAgYWN0aXZlID0gMCwgLy8gbnVtYmVyIG9mIHRhc2tzIGN1cnJlbnRseSBiZWluZyBleGVjdXRlZCAoc3RhcnRlZCBidXQgbm90IGZpbmlzaGVkKVxuICAgICAgICByZW1haW5pbmcgPSAwLCAvLyBudW1iZXIgb2YgdGFza3Mgbm90IHlldCBmaW5pc2hlZFxuICAgICAgICBwb3BwaW5nLCAvLyBpbnNpZGUgYSBzeW5jaHJvbm91cyB0YXNrIGNhbGxiYWNrP1xuICAgICAgICBlcnJvciA9IG51bGwsXG4gICAgICAgIGF3YWl0ID0gbm9vcCxcbiAgICAgICAgYWxsO1xuXG4gICAgaWYgKCFwYXJhbGxlbGlzbSkgcGFyYWxsZWxpc20gPSBJbmZpbml0eTtcblxuICAgIGZ1bmN0aW9uIHBvcCgpIHtcbiAgICAgIHdoaWxlIChwb3BwaW5nID0gc3RhcnRlZCA8IHRhc2tzLmxlbmd0aCAmJiBhY3RpdmUgPCBwYXJhbGxlbGlzbSkge1xuICAgICAgICB2YXIgaSA9IHN0YXJ0ZWQrKyxcbiAgICAgICAgICAgIHQgPSB0YXNrc1tpXSxcbiAgICAgICAgICAgIGEgPSBzbGljZS5jYWxsKHQsIDEpO1xuICAgICAgICBhLnB1c2goY2FsbGJhY2soaSkpO1xuICAgICAgICArK2FjdGl2ZTtcbiAgICAgICAgdFswXS5hcHBseShudWxsLCBhKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhpKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oZSwgcikge1xuICAgICAgICAtLWFjdGl2ZTtcbiAgICAgICAgaWYgKGVycm9yICE9IG51bGwpIHJldHVybjtcbiAgICAgICAgaWYgKGUgIT0gbnVsbCkge1xuICAgICAgICAgIGVycm9yID0gZTsgLy8gaWdub3JlIG5ldyB0YXNrcyBhbmQgc3F1ZWxjaCBhY3RpdmUgY2FsbGJhY2tzXG4gICAgICAgICAgc3RhcnRlZCA9IHJlbWFpbmluZyA9IE5hTjsgLy8gc3RvcCBxdWV1ZWQgdGFza3MgZnJvbSBzdGFydGluZ1xuICAgICAgICAgIG5vdGlmeSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhc2tzW2ldID0gcjtcbiAgICAgICAgICBpZiAoLS1yZW1haW5pbmcpIHBvcHBpbmcgfHwgcG9wKCk7XG4gICAgICAgICAgZWxzZSBub3RpZnkoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBub3RpZnkoKSB7XG4gICAgICBpZiAoZXJyb3IgIT0gbnVsbCkgYXdhaXQoZXJyb3IpO1xuICAgICAgZWxzZSBpZiAoYWxsKSBhd2FpdChlcnJvciwgdGFza3MpO1xuICAgICAgZWxzZSBhd2FpdC5hcHBseShudWxsLCBbZXJyb3JdLmNvbmNhdCh0YXNrcykpO1xuICAgIH1cblxuICAgIHJldHVybiBxID0ge1xuICAgICAgZGVmZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIWVycm9yKSB7XG4gICAgICAgICAgdGFza3MucHVzaChhcmd1bWVudHMpO1xuICAgICAgICAgICsrcmVtYWluaW5nO1xuICAgICAgICAgIHBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBxO1xuICAgICAgfSxcbiAgICAgIGF3YWl0OiBmdW5jdGlvbihmKSB7XG4gICAgICAgIGF3YWl0ID0gZjtcbiAgICAgICAgYWxsID0gZmFsc2U7XG4gICAgICAgIGlmICghcmVtYWluaW5nKSBub3RpZnkoKTtcbiAgICAgICAgcmV0dXJuIHE7XG4gICAgICB9LFxuICAgICAgYXdhaXRBbGw6IGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgYXdhaXQgPSBmO1xuICAgICAgICBhbGwgPSB0cnVlO1xuICAgICAgICBpZiAoIXJlbWFpbmluZykgbm90aWZ5KCk7XG4gICAgICAgIHJldHVybiBxO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBub29wKCkge31cblxuICBxdWV1ZS52ZXJzaW9uID0gXCIxLjAuN1wiO1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIHF1ZXVlOyB9KTtcbiAgZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIiAmJiBtb2R1bGUuZXhwb3J0cykgbW9kdWxlLmV4cG9ydHMgPSBxdWV1ZTtcbiAgZWxzZSB0aGlzLnF1ZXVlID0gcXVldWU7XG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpLFxuICAgIHBvbHlsaW5lID0gcmVxdWlyZSgncG9seWxpbmUnKSxcbiAgICBxdWV1ZSA9IHJlcXVpcmUoJ3F1ZXVlLWFzeW5jJyk7XG5cbnZhciBEaXJlY3Rpb25zID0gTC5DbGFzcy5leHRlbmQoe1xuICAgIGluY2x1ZGVzOiBbTC5NaXhpbi5FdmVudHNdLFxuXG4gICAgb3B0aW9uczoge1xuICAgICAgICB1bml0czogJ2ltcGVyaWFsJ1xuICAgIH0sXG5cbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIFVSTF9URU1QTEFURTogJ2h0dHBzOi8vYXBpLnRpbGVzLm1hcGJveC5jb20vdjQvZGlyZWN0aW9ucy97cHJvZmlsZX0ve3dheXBvaW50c30uanNvbj9pbnN0cnVjdGlvbnM9aHRtbCZnZW9tZXRyeT1wb2x5bGluZSZhY2Nlc3NfdG9rZW49e3Rva2VufScsXG4gICAgICAgIEdFT0NPREVSX1RFTVBMQVRFOiAnaHR0cHM6Ly9hcGkudGlsZXMubWFwYm94LmNvbS92NC9nZW9jb2RlL21hcGJveC5wbGFjZXMve3F1ZXJ5fS5qc29uP3Byb3hpbWl0eT17cHJveGltaXR5fSZhY2Nlc3NfdG9rZW49e3Rva2VufSdcbiAgICB9LFxuXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX3dheXBvaW50cyA9IFtdO1xuICAgIH0sXG5cbiAgICBnZXRPcmlnaW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3JpZ2luO1xuICAgIH0sXG5cbiAgICBnZXREZXN0aW5hdGlvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXN0aW5hdGlvbjtcbiAgICB9LFxuXG4gICAgc2V0T3JpZ2luOiBmdW5jdGlvbiAob3JpZ2luKSB7XG4gICAgICAgIG9yaWdpbiA9IHRoaXMuX25vcm1hbGl6ZVdheXBvaW50KG9yaWdpbik7XG5cbiAgICAgICAgdGhpcy5vcmlnaW4gPSBvcmlnaW47XG4gICAgICAgIHRoaXMuZmlyZSgnb3JpZ2luJywge29yaWdpbjogb3JpZ2lufSk7XG5cbiAgICAgICAgaWYgKCFvcmlnaW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VubG9hZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNldERlc3RpbmF0aW9uOiBmdW5jdGlvbiAoZGVzdGluYXRpb24pIHtcbiAgICAgICAgZGVzdGluYXRpb24gPSB0aGlzLl9ub3JtYWxpemVXYXlwb2ludChkZXN0aW5hdGlvbik7XG5cbiAgICAgICAgdGhpcy5kZXN0aW5hdGlvbiA9IGRlc3RpbmF0aW9uO1xuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3RpbmF0aW9uJywge2Rlc3RpbmF0aW9uOiBkZXN0aW5hdGlvbn0pO1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3VubG9hZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIGdldFByb2ZpbGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9maWxlIHx8IHRoaXMub3B0aW9ucy5wcm9maWxlIHx8ICdtYXBib3guZHJpdmluZyc7XG4gICAgfSxcblxuICAgIHNldFByb2ZpbGU6IGZ1bmN0aW9uIChwcm9maWxlKSB7XG4gICAgICAgIHRoaXMucHJvZmlsZSA9IHByb2ZpbGU7XG4gICAgICAgIHRoaXMuZmlyZSgncHJvZmlsZScsIHtwcm9maWxlOiBwcm9maWxlfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBnZXRXYXlwb2ludHM6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2F5cG9pbnRzO1xuICAgIH0sXG5cbiAgICBzZXRXYXlwb2ludHM6IGZ1bmN0aW9uICh3YXlwb2ludHMpIHtcbiAgICAgICAgdGhpcy5fd2F5cG9pbnRzID0gd2F5cG9pbnRzLm1hcCh0aGlzLl9ub3JtYWxpemVXYXlwb2ludCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBhZGRXYXlwb2ludDogZnVuY3Rpb24gKGluZGV4LCB3YXlwb2ludCkge1xuICAgICAgICB0aGlzLl93YXlwb2ludHMuc3BsaWNlKGluZGV4LCAwLCB0aGlzLl9ub3JtYWxpemVXYXlwb2ludCh3YXlwb2ludCkpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgcmVtb3ZlV2F5cG9pbnQ6IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICB0aGlzLl93YXlwb2ludHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNldFdheXBvaW50OiBmdW5jdGlvbiAoaW5kZXgsIHdheXBvaW50KSB7XG4gICAgICAgIHRoaXMuX3dheXBvaW50c1tpbmRleF0gPSB0aGlzLl9ub3JtYWxpemVXYXlwb2ludCh3YXlwb2ludCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICByZXZlcnNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBvID0gdGhpcy5vcmlnaW4sXG4gICAgICAgICAgICBkID0gdGhpcy5kZXN0aW5hdGlvbjtcblxuICAgICAgICB0aGlzLm9yaWdpbiA9IGQ7XG4gICAgICAgIHRoaXMuZGVzdGluYXRpb24gPSBvO1xuICAgICAgICB0aGlzLl93YXlwb2ludHMucmV2ZXJzZSgpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnb3JpZ2luJywge29yaWdpbjogdGhpcy5vcmlnaW59KVxuICAgICAgICAgICAgLmZpcmUoJ2Rlc3RpbmF0aW9uJywge2Rlc3RpbmF0aW9uOiB0aGlzLmRlc3RpbmF0aW9ufSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNlbGVjdFJvdXRlOiBmdW5jdGlvbiAocm91dGUpIHtcbiAgICAgICAgdGhpcy5maXJlKCdzZWxlY3RSb3V0ZScsIHtyb3V0ZTogcm91dGV9KTtcbiAgICB9LFxuXG4gICAgaGlnaGxpZ2h0Um91dGU6IGZ1bmN0aW9uIChyb3V0ZSkge1xuICAgICAgICB0aGlzLmZpcmUoJ2hpZ2hsaWdodFJvdXRlJywge3JvdXRlOiByb3V0ZX0pO1xuICAgIH0sXG5cbiAgICBoaWdobGlnaHRTdGVwOiBmdW5jdGlvbiAoc3RlcCkge1xuICAgICAgICB0aGlzLmZpcmUoJ2hpZ2hsaWdodFN0ZXAnLCB7c3RlcDogc3RlcH0pO1xuICAgIH0sXG5cbiAgICBxdWVyeVVSTDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdGVtcGxhdGUgPSBEaXJlY3Rpb25zLlVSTF9URU1QTEFURSxcbiAgICAgICAgICAgIHRva2VuID0gdGhpcy5vcHRpb25zLmFjY2Vzc1Rva2VuIHx8IEwubWFwYm94LmFjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgcHJvZmlsZSA9IHRoaXMuZ2V0UHJvZmlsZSgpLFxuICAgICAgICAgICAgcG9pbnRzID0gW3RoaXMub3JpZ2luXS5jb25jYXQodGhpcy5fd2F5cG9pbnRzKS5jb25jYXQoW3RoaXMuZGVzdGluYXRpb25dKS5tYXAoZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50Lmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgfSkuam9pbignOycpO1xuXG4gICAgICAgIGlmIChMLm1hcGJveC5mZWVkYmFjaykge1xuICAgICAgICAgICAgTC5tYXBib3guZmVlZGJhY2sucmVjb3JkKHtkaXJlY3Rpb25zOiBwcm9maWxlICsgJzsnICsgcG9pbnRzfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTC5VdGlsLnRlbXBsYXRlKHRlbXBsYXRlLCB7XG4gICAgICAgICAgICB0b2tlbjogdG9rZW4sXG4gICAgICAgICAgICBwcm9maWxlOiBwcm9maWxlLFxuICAgICAgICAgICAgd2F5cG9pbnRzOiBwb2ludHNcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIHF1ZXJ5YWJsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRPcmlnaW4oKSAmJiB0aGlzLmdldERlc3RpbmF0aW9uKCk7XG4gICAgfSxcblxuICAgIHF1ZXJ5OiBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcbiAgICAgICAgaWYgKCF0aGlzLnF1ZXJ5YWJsZSgpKSByZXR1cm4gdGhpcztcblxuICAgICAgICBpZiAodGhpcy5fcXVlcnkpIHtcbiAgICAgICAgICAgIHRoaXMuX3F1ZXJ5LmFib3J0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcmVxdWVzdHMgJiYgdGhpcy5fcmVxdWVzdHMubGVuZ3RoKSB0aGlzLl9yZXF1ZXN0cy5mb3JFYWNoKGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHJlcXVlc3QuYWJvcnQoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3JlcXVlc3RzID0gW107XG5cbiAgICAgICAgdmFyIHEgPSBxdWV1ZSgpO1xuXG4gICAgICAgIHZhciBwdHMgPSBbdGhpcy5vcmlnaW4sIHRoaXMuZGVzdGluYXRpb25dLmNvbmNhdCh0aGlzLl93YXlwb2ludHMpO1xuICAgICAgICBmb3IgKHZhciBpIGluIHB0cykge1xuICAgICAgICAgICAgaWYgKCFwdHNbaV0uZ2VvbWV0cnkuY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgICAgICAgICBxLmRlZmVyKEwuYmluZCh0aGlzLl9nZW9jb2RlLCB0aGlzKSwgcHRzW2ldLCBvcHRzLnByb3hpbWl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBxLmF3YWl0KEwuYmluZChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5maXJlKCdlcnJvcicsIHtlcnJvcjogZXJyLm1lc3NhZ2V9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcXVlcnkgPSByZXF1ZXN0KHRoaXMucXVlcnlVUkwoKSwgTC5iaW5kKGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWVyeSA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmZpcmUoJ2Vycm9yJywge2Vycm9yOiBlcnIubWVzc2FnZX0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZGlyZWN0aW9ucyA9IHJlc3A7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXJlY3Rpb25zLnJvdXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChyb3V0ZSkge1xuICAgICAgICAgICAgICAgICAgICByb3V0ZS5nZW9tZXRyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiTGluZVN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRpbmF0ZXM6IHBvbHlsaW5lLmRlY29kZShyb3V0ZS5nZW9tZXRyeSwgNikubWFwKGZ1bmN0aW9uIChjKSB7IHJldHVybiBjLnJldmVyc2UoKTsgfSlcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vcmlnaW4ucHJvcGVydGllcy5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub3JpZ2luID0gdGhpcy5kaXJlY3Rpb25zLm9yaWdpbjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpcmVjdGlvbnMub3JpZ2luID0gdGhpcy5vcmlnaW47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlc3RpbmF0aW9uLnByb3BlcnRpZXMubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlc3RpbmF0aW9uID0gdGhpcy5kaXJlY3Rpb25zLmRlc3RpbmF0aW9uO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlyZWN0aW9ucy5kZXN0aW5hdGlvbiA9IHRoaXMuZGVzdGluYXRpb247XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdsb2FkJywgdGhpcy5kaXJlY3Rpb25zKTtcbiAgICAgICAgICAgIH0sIHRoaXMpLCB0aGlzKTtcbiAgICAgICAgfSwgdGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfZ2VvY29kZTogZnVuY3Rpb24od2F5cG9pbnQsIHByb3hpbWl0eSwgY2IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yZXF1ZXN0cykgdGhpcy5fcmVxdWVzdHMgPSBbXTtcbiAgICAgICAgdGhpcy5fcmVxdWVzdHMucHVzaChyZXF1ZXN0KEwuVXRpbC50ZW1wbGF0ZShEaXJlY3Rpb25zLkdFT0NPREVSX1RFTVBMQVRFLCB7XG4gICAgICAgICAgICBxdWVyeTogd2F5cG9pbnQucHJvcGVydGllcy5xdWVyeSxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4gfHwgTC5tYXBib3guYWNjZXNzVG9rZW4sXG4gICAgICAgICAgICBwcm94aW1pdHk6IHByb3hpbWl0eSA/IFtwcm94aW1pdHkubG5nLCBwcm94aW1pdHkubGF0XS5qb2luKCcsJykgOiAnJ1xuICAgICAgICB9KSwgTC5iaW5kKGZ1bmN0aW9uIChlcnIsIHJlc3ApIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFyZXNwLmZlYXR1cmVzIHx8ICFyZXNwLmZlYXR1cmVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYihuZXcgRXJyb3IoXCJObyByZXN1bHRzIGZvdW5kIGZvciBxdWVyeSBcIiArIHdheXBvaW50LnByb3BlcnRpZXMucXVlcnkpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2F5cG9pbnQuZ2VvbWV0cnkuY29vcmRpbmF0ZXMgPSByZXNwLmZlYXR1cmVzWzBdLmNlbnRlcjtcbiAgICAgICAgICAgIHdheXBvaW50LnByb3BlcnRpZXMubmFtZSA9IHJlc3AuZmVhdHVyZXNbMF0ucGxhY2VfbmFtZTtcblxuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgIH0sIHRoaXMpKSk7XG4gICAgfSxcblxuICAgIF91bmxvYWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fd2F5cG9pbnRzID0gW107XG4gICAgICAgIGRlbGV0ZSB0aGlzLmRpcmVjdGlvbnM7XG4gICAgICAgIHRoaXMuZmlyZSgndW5sb2FkJyk7XG4gICAgfSxcblxuICAgIF9ub3JtYWxpemVXYXlwb2ludDogZnVuY3Rpb24gKHdheXBvaW50KSB7XG4gICAgICAgIGlmICghd2F5cG9pbnQgfHwgd2F5cG9pbnQudHlwZSA9PT0gJ0ZlYXR1cmUnKSB7XG4gICAgICAgICAgICByZXR1cm4gd2F5cG9pbnQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY29vcmRpbmF0ZXMsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzID0ge307XG5cbiAgICAgICAgaWYgKHdheXBvaW50IGluc3RhbmNlb2YgTC5MYXRMbmcpIHtcbiAgICAgICAgICAgIHdheXBvaW50ID0gd2F5cG9pbnQud3JhcCgpO1xuICAgICAgICAgICAgY29vcmRpbmF0ZXMgPSBwcm9wZXJ0aWVzLnF1ZXJ5ID0gW3dheXBvaW50LmxuZywgd2F5cG9pbnQubGF0XTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXlwb2ludCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgICBjb29yZGluYXRlcyA9IHByb3BlcnRpZXMucXVlcnkgPSBbd2F5cG9pbnRbMV0sIHdheXBvaW50WzBdXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygd2F5cG9pbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzLnF1ZXJ5ID0gd2F5cG9pbnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBjb29yZGluYXRlc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHByb3BlcnRpZXNcbiAgICAgICAgfTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBEaXJlY3Rpb25zKG9wdGlvbnMpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNvcnNsaXRlID0gcmVxdWlyZSgnY29yc2xpdGUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGNvcnNsaXRlKHVybCwgZnVuY3Rpb24gKGVyciwgcmVzcCkge1xuICAgICAgICBpZiAoZXJyICYmIGVyci50eXBlID09PSAnYWJvcnQnKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXJyICYmICFlcnIucmVzcG9uc2VUZXh0KSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3AgPSByZXNwIHx8IGVycjtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UocmVzcC5yZXNwb25zZVRleHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKHJlc3AucmVzcG9uc2VUZXh0KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVzcC5lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcihyZXNwLmVycm9yKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmVzcCk7XG4gICAgfSk7XG59O1xuIl19
;