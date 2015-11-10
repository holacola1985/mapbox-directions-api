# Directions

## L.mapbox.directions(options)

<span class='leaflet icon'>_Extends_: `L.Class`</span>

| Options | Type | Description |
| ---- | ---- | ---- |
| options | object | [Directions options](#directions-options) object |

## Directions options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `accessToken` | String | `null` | Required unless `L.mapbox.accessToken` is set globally |
| `profile` | String | `mapbox.driving` | Routing profile to use. Options: `mapbox.driving`, `mapbox.walking`, `mapbox.cycling` |
| `units` | String | `imperial` | Measurement system to be used in navigation instructions. Options: `imperial`, `metric` |

### directions.getOrigin()

Returns the origin of the current route.

_Returns_: the origin

### directions.setOrigin()

Sets the origin of the current route.

_Returns_: `this`

### directions.getDestination()

Returns the destination of the current route.

_Returns_: the destination

### directions.setDestination()

Sets the destination of the current route.

_Returns_: `this`

### directions.addWaypoint(index, waypoint)

Add a waypoint to the route at the given index. `waypoint` can be a GeoJSON Point Feature or a `L.LatLng`.

_Returns_: `this`

### directions.removeWaypoint(index)

Remove the waypoint at the given index from the route.

_Returns_: `this`

### directions.setWaypoint(index, waypoint)

Change the waypoint at the given index. `waypoint` can be a GeoJSON Point Feature or a `L.LatLng`.

_Returns_: `this`

### directions.reverse()

Swap the origin and destination.

_Returns_: `this`

### directions.query(opts)

Send a directions query request. `opts` can contain a `proximity` LatLng object for geocoding origin/destination/waypoint strings.

_Returns_: `this`

