import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

const RideMapView = ({ pickup, destination, routeLine, currentLocation, isDeviated, deviatedLocation }) => {
  if (!pickup || !destination) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d81b60" />
        <Text>Loading map...</Text>
      </View>
    );
  }

  const routeCoordsJS = JSON.stringify(routeLine || []);

  const currentLocJS = currentLocation
    ? `[${currentLocation.latitude}, ${currentLocation.longitude}]`
    : null;

  const deviatedLocJS = deviatedLocation
    ? `[${deviatedLocation.latitude}, ${deviatedLocation.longitude}]`
    : null;

  const mapHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }

      html, body {
        height: 100%;
        overflow: hidden;
        background: #e8e0f0;
      }

      #map {
        height: 100%;
        width: 100%;
        /*
          touch-action: none lets Leaflet own ALL touch events inside the
          WebView. The parent ScrollView never sees them because the WebView
          boundary acts as a hard stop — as long as the WebView itself is
          outside the ScrollView (handled in RideScreen.js).
        */
        touch-action: none;
      }

      /* ── Zoom buttons ── */
      .zoom-controls {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .zoom-btn {
        width: 36px;
        height: 36px;
        background: rgba(255,255,255,0.95);
        border: none;
        border-radius: 8px;
        font-size: 22px;
        font-weight: 700;
        color: #333;
        box-shadow: 0 2px 6px rgba(0,0,0,0.22);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      .zoom-btn:active { background: #eee; }

      /* Legend overlay */
      .map-legend {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(255,255,255,0.92);
        border-radius: 8px;
        padding: 6px 10px;
        font-family: sans-serif;
        font-size: 11px;
        z-index: 1000;
        box-shadow: 0 1px 6px rgba(0,0,0,0.18);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .legend-row { display: flex; align-items: center; gap: 6px; }
      .legend-line {
        width: 22px; height: 4px; border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>

    <!-- Zoom buttons rendered over the map, inside the WebView -->
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoomIn">+</button>
      <button class="zoom-btn" id="zoomOut">−</button>
    </div>

    <script>
      var isDeviated = ${isDeviated ? 'true' : 'false'};

      var map = L.map('map', {
        zoomControl: false,      // we supply our own +/- buttons above
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,         // pinch-to-zoom — works now that map is outside ScrollView
        boxZoom: false,
        keyboard: false,
        tap: false,              // disable Leaflet's tap shim; native touch handles it
      }).setView([${pickup.latitude}, ${pickup.longitude}], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
      }).addTo(map);

      // ── Zoom button handlers ──────────────────────────────────────
      document.getElementById('zoomIn').addEventListener('click', function(e) {
        e.stopPropagation();
        map.zoomIn();
      });
      document.getElementById('zoomOut').addEventListener('click', function(e) {
        e.stopPropagation();
        map.zoomOut();
      });

      // ── Custom icons ──────────────────────────────────────────────
      var pickupIcon = L.divIcon({
        className: '',
        html: '<div style="background:#43a047;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      var destIcon = L.divIcon({
        className: '',
        html: '<div style="background:#d81b60;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      var userIcon = L.divIcon({
        className: '',
        html: '<div style="background:#1565c0;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(21,101,192,0.6)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      var deviatedUserIcon = L.divIcon({
        className: '',
        html: '<div style="background:#e53935;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(229,57,53,0.7)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      // ── Markers ───────────────────────────────────────────────────
      L.marker([${pickup.latitude}, ${pickup.longitude}], { icon: pickupIcon })
        .addTo(map)
        .bindTooltip('Pickup', { permanent: false, direction: 'top' });

      L.marker([${destination.latitude}, ${destination.longitude}], { icon: destIcon })
        .addTo(map)
        .bindTooltip('Destination', { permanent: false, direction: 'top' });

      // ── Planned route (always GREEN) ──────────────────────────────
      var route = ${routeCoordsJS};
      var plannedPolyline = null;
      if (route.length > 0) {
        var latlngs = route.map(function(p) { return [p.latitude, p.longitude]; });
        plannedPolyline = L.polyline(latlngs, {
          color: '#43a047',
          weight: 5,
          opacity: isDeviated ? 0.7 : 1.0,
          dashArray: isDeviated ? '8, 6' : null,
        }).addTo(map);

        if (!isDeviated) {
          map.fitBounds(plannedPolyline.getBounds(), { padding: [20, 20] });
        }
      }

      // ── Deviated path (RED) ───────────────────────────────────────
      var userMarker = null;

      ${deviatedLocJS ? `
      if (isDeviated) {
        var devLat = ${deviatedLocJS}[0];
        var devLng = ${deviatedLocJS}[1];

        var destLat = ${destination.latitude};
        var destLng = ${destination.longitude};

        var branchLat = devLat;
        var branchLng = devLng;

        if (route.length > 0) {
          var minDist = Infinity;
          for (var i = 0; i < route.length; i++) {
            var rLat = route[i].latitude;
            var rLng = route[i].longitude;
            var dLat = rLat - devLat;
            var dLng = rLng - devLng;
            var dist = dLat * dLat + dLng * dLng;
            if (dist < minDist) {
              minDist = dist;
              branchLat = rLat;
              branchLng = rLng;
            }
          }
        }

        var midLat = (devLat + destLat) / 2 + 0.005;
        var midLng = (devLng + destLng) / 2 + 0.005;

        var deviatedPath = [
          [branchLat, branchLng],
          [devLat, devLng],
          [midLat, midLng],
          [destLat, destLng],
        ];

        var deviatedPolyline = L.polyline(deviatedPath, {
          color: '#e53935',
          weight: 5,
          opacity: 0.9,
          dashArray: '10, 5',
        }).addTo(map);

        var allBounds = [];
        if (plannedPolyline) {
          plannedPolyline.getLatLngs().forEach(function(ll) { allBounds.push(ll); });
        }
        deviatedPath.forEach(function(p) { allBounds.push(L.latLng(p[0], p[1])); });
        if (allBounds.length > 0) {
          map.fitBounds(L.latLngBounds(allBounds), { padding: [24, 24] });
        }

        userMarker = L.marker([devLat, devLng], { icon: deviatedUserIcon })
          .addTo(map)
          .bindTooltip('⚠️ Off Route', { permanent: true, direction: 'top', className: '' });
      }
      ` : ''}

      ${currentLocJS && !deviatedLocJS ? `
      if (!isDeviated) {
        userMarker = L.marker(${currentLocJS}, { icon: userIcon }).addTo(map);
        map.panTo(${currentLocJS});
      }
      ` : ''}

      // ── Legend ────────────────────────────────────────────────────
      if (isDeviated) {
        var legend = document.createElement('div');
        legend.className = 'map-legend';
        legend.innerHTML =
          '<div class="legend-row"><div class="legend-line" style="background:#43a047;"></div><span>Planned Route</span></div>' +
          '<div class="legend-row"><div class="legend-line" style="background:#e53935;"></div><span>Deviated Path</span></div>';
        document.body.appendChild(legend);
      }
    </script>
  </body>
  </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: mapHTML }}
        style={{ flex: 1 }}
        /*
          scrollEnabled={false} is correct here — it stops the WebView's
          OWN scroll behaviour (there is none in a map). The map's pan/zoom
          gestures are handled entirely inside the HTML by Leaflet, not by
          the WebView scroll system.
          Since the WebView now lives OUTSIDE the parent ScrollView
          (see RideScreen.js), there is no gesture conflict at the RN layer.
        */
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled={false}
        javaScriptEnabled={true}
        /*
          Do NOT set onStartShouldSetResponder / onMoveShouldSetResponder —
          those were returning true and claiming all gestures for the View,
          which prevented Leaflet's own touch handlers from firing reliably
          on Android. Removing them lets the WebView (and Leaflet inside it)
          handle gestures natively.
        */
      />
    </View>
  );
};

export default RideMapView;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});