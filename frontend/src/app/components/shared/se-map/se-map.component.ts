import {
  Component,
  input,
  OnInit,
  output,
  SimpleChanges,
  ChangeDetectionStrategy,
  OnChanges,
  inject,
  signal,
} from '@angular/core';
import * as L from 'leaflet';
import { MapPoint } from 'src/app/models/Map';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

// How long to wait, after the mouse leaves a group's rest marker or one of
// its fanned-out members, before collapsing back to the merged marker.
const COLLAPSE_DELAY_MS = 300;

// Points within this many pixels of each other, at the current zoom, are
// treated as overlapping and merged into one marker at rest. Since this is
// a pixel (not coordinate) distance, the same two points can be grouped
// while zoomed out and split back apart once zooming in gives them enough
// room to show individually.
const GROUPING_PIXEL_DISTANCE = 30;

// Base pixel radius used to fan grouped points out around their shared
// coordinate. Computing the fan-out in pixel-space (via the map's own
// project/unproject) means the fanned markers stay visually separated
// and individually clickable at any zoom level.
const FAN_OUT_RADIUS_PIXELS = 28;

// zIndexOffset applied to a marker while it's hovered/expanded, so it (or
// its fanned-out members) render above any other marker Leaflet would
// otherwise stack in front of it based on vertical map position.
const HOVER_Z_INDEX_OFFSET = 10000;

// A single map spot: one or more MapPoints that are within clustering
// distance of each other at the current zoom.
interface MarkerGroup {
  points: MapPoint[];
  lat: number;
  long: number;
  restMarker: L.Marker;
  fannedMarkers: L.Marker[] | null;
  collapseTimeout: ReturnType<typeof setTimeout> | null;
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
}

@Component({
  selector: 'se-map',
  templateUrl: './se-map.component.html',
  styleUrls: ['./se-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeMapComponent implements OnInit, OnChanges {
  points = input.required<MapPoint[]>();
  selectedPoint = input<string>();
  showLegend = input<boolean>();
  hoverPoint = output<string | undefined>();
  clickPoint = output<string>();

  private screenSizeService = inject(ScreenSizeService);

  map!: L.Map;
  markerGroups: MarkerGroup[] = [];
  // Rendered as a plain DOM element outside the map
  tooltip = signal<TooltipState | undefined>(undefined);

  constructor() {}

  ngOnInit(): void {
    // setup base map
    this.map = L.map('se-map').setView([31.5, -84], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    // Tapping the map itself (not a marker) collapses whatever group is
    // currently fanned out - the mobile equivalent of moving the mouse away.
    this.map.on('click', () => this.collapseAllGroups());
    // A zoom mid-fan-out would leave the fanned markers at stale pixel
    // offsets, so just collapse back to the merged marker instead.
    this.map.on('zoomstart', () => this.collapseAllGroups());
    // Whether two points are close enough to merge depends on their pixel
    // distance, which changes with zoom - re-cluster after every zoom so
    // points split back into individual markers once there's enough room
    // to show them separately (and merge again when zoomed back out).
    this.map.on('zoomend', () => this.rebuildMarkerGroups());

    this.rebuildMarkerGroups();
  }

  // Tears down all current markers and rebuilds them from `points()`,
  // re-clustering by the current zoom's pixel distances.
  private rebuildMarkerGroups() {
    // clears all existing marker groups from the map
    this.markerGroups.forEach((group) => {
      if (group.collapseTimeout) {
        clearTimeout(group.collapseTimeout);
      }
      this.map.removeLayer(group.restMarker);
      group.fannedMarkers?.forEach((marker) => this.map.removeLayer(marker));
    });
    this.markerGroups = [];

    // rebuild markerGroups based on their grouping at the current zoom's pixel distances
    this.groupPointsByPixelDistance(this.points()).forEach((group) =>
      this.createMarkerGroup(group),
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    // changes to selectedPoint
    if (changes['selectedPoint']) {
      this.selectPoint();
    }
  }

  // Groups `points` by pixel distance at the current zoom, so points that
  // visually overlap (or nearly do) on screen share a single marker at
  // rest, regardless of how far apart their real coordinates are.
  private groupPointsByPixelDistance(points: MapPoint[]): MapPoint[][] {
    const zoom = this.map.getZoom();
    const clusters: { anchor: L.Point; points: MapPoint[] }[] = [];
    points.forEach((point) => {
      const pixel = this.map.project([point.lat, point.long], zoom);
      const cluster = clusters.find((c) => c.anchor.distanceTo(pixel) <= GROUPING_PIXEL_DISTANCE);
      if (cluster) {
        cluster.points.push(point);
      } else {
        clusters.push({ anchor: pixel, points: [point] });
      }
    });
    return clusters.map((c) => c.points);
  }

  // pushes a new marker group onto the map based on the given points
  private createMarkerGroup(points: MapPoint[]) {
    // Render the merged marker at the group's centroid rather than any one
    // member's coordinate, since pixel-based clustering can group points
    // that don't all share the exact same real-world location.
    const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const long = points.reduce((sum, point) => sum + point.long, 0) / points.length;
    const group: MarkerGroup = {
      points,
      lat,
      long,
      restMarker: null as unknown as L.Marker,
      fannedMarkers: null,
      collapseTimeout: null,
    };
    group.restMarker = this.createRestMarker(group);
    this.markerGroups.push(group);
  }

  // Creates the marker shown for a group at rest: a normal single marker,
  // or a merged marker with a count badge.
  private createRestMarker(group: MarkerGroup): L.Marker {
    const isGrouped = group.points.length > 1;
    const marker = L.marker([group.lat, group.long], {
      icon: isGrouped ? this.createGroupIcon(group.points.length) : new L.Icon.Default(),
      // Give merged markers a standing z-index boost so their count badge
      // stays legible
      zIndexOffset: isGrouped ? 500 : 0,
    }).addTo(this.map);

    // apply the color to the marker
    if (!isGrouped && group.points[0].colorClass) {
      marker.getElement()?.classList.add(group.points[0].colorClass);
    }

    if (isGrouped) {
      // Desktop: hovering the merged marker fans it out; moving away
      // (after the grace period) collapses it back.
      marker.on('mouseover', () => this.expandGroup(group));
      marker.on('mouseout', () => this.scheduleCollapse(group));
      // Mobile: there's no hover, so tapping toggles the fan-out instead.
      marker.on('click', () => {
        if (this.screenSizeService.isMobile()) {
          if (group.fannedMarkers) {
            this.collapseGroup(group);
          } else {
            this.collapseAllGroups();
            this.expandGroup(group);
          }
        }
      });
    } else {
      const point = group.points[0];
      // Bring the marker to the front on hover and show its tooltip
      marker.on('mouseover', () => {
        marker.setZIndexOffset(HOVER_Z_INDEX_OFFSET);
        this.showTooltip(marker, point.name);
        this.hoverPoint.emit(point.id);
      });
      marker.on('mouseout', () => {
        marker.setZIndexOffset(0);
        this.hideTooltip();
        this.hoverPoint.emit(undefined);
      });
      marker.on('click', () => this.clickPoint.emit(point.id));
    }

    return marker;
  }

  // Divicon with a count badge, shown for a group's merged marker at rest.
  private createGroupIcon(count: number): L.DivIcon {
    return L.divIcon({
      className: 'group-marker',
      html: `<span class="group-marker-count">${count}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  // Shows the custom tooltip with `name` above the given marker's current
  // position.
  private showTooltip(marker: L.Marker, name: string) {
    const { x, y } = this.map.latLngToContainerPoint(marker.getLatLng());
    this.tooltip.set({ x, y, name });
  }

  private hideTooltip() {
    this.tooltip.set(undefined);
  }

  // Computes fan-out positions for a group's members in pixel-space around
  // the shared coordinate, then converts each back to a real lat/lng. Using
  // pixel-space for the spread.
  private computeFanOutPositions(center: L.LatLng, count: number): L.LatLng[] {
    const zoom = this.map.getZoom();
    const centerPoint = this.map.project(center, zoom);
    // Widen the radius a bit for larger groups so members don't overlap.
    const radius = FAN_OUT_RADIUS_PIXELS + Math.max(0, count - 4) * 6;

    // Spread members evenly around a full circle (2π) so each gets its own
    // angle, then convert that pixel-space point back to a real lat/lng.
    return Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count;
      const point = centerPoint.add(L.point(radius * Math.cos(angle), radius * Math.sin(angle)));
      return this.map.unproject(point, zoom);
    });
  }

  // Temporarily replaces a group's merged marker with one marker per point,
  // offset in a small circle around the shared coordinate.
  private expandGroup(group: MarkerGroup) {
    if (group.collapseTimeout) {
      clearTimeout(group.collapseTimeout);
      group.collapseTimeout = null;
    }
    if (group.fannedMarkers) {
      return;
    }
    this.map.removeLayer(group.restMarker);
    this.hideTooltip();

    // Hide every other marker on the map while this group is fanned out.
    this.setOtherMarkersHidden(group, true);

    // Show markers for each point in the group.
    const positions = this.computeFanOutPositions(
      L.latLng(group.lat, group.long),
      group.points.length,
    );
    group.fannedMarkers = group.points.map((point, i) => {
      const marker = L.marker(positions[i]).addTo(this.map);
      // Fanned markers are transient/actively-interacted-with, so always
      // render them above any other marker on the map.
      marker.setZIndexOffset(HOVER_Z_INDEX_OFFSET);

      // Apply the point's color class
      if (point.colorClass) {
        marker.getElement()?.classList.add(point.colorClass);
      }
      if (point.id === this.selectedPoint()) {
        marker.getElement()?.classList.add('active-marker');
      }

      // Fanned markers behave exactly like a normal individual marker,
      // just also clearing this group's collapse grace period so moving
      // between fanned members doesn't collapse the group mid-hover.
      marker.on('mouseover', () => {
        if (group.collapseTimeout) {
          clearTimeout(group.collapseTimeout);
          group.collapseTimeout = null;
        }
        this.showTooltip(marker, point.name);
        this.hoverPoint.emit(point.id);
      });
      marker.on('mouseout', () => {
        this.hideTooltip();
        this.hoverPoint.emit(undefined);
        this.scheduleCollapse(group);
      });
      marker.on('click', () => {
        this.clickPoint.emit(point.id);
        if (this.screenSizeService.isMobile()) {
          this.collapseGroup(group);
        }
      });

      return marker;
    });
  }

  // Schedules a group's collapse back to its merged marker after a short
  // grace period, so mouse movement between the rest marker and its fanned
  // members doesn't cause flicker.
  private scheduleCollapse(group: MarkerGroup) {
    if (group.collapseTimeout) {
      clearTimeout(group.collapseTimeout);
    }
    group.collapseTimeout = setTimeout(() => this.collapseGroup(group), COLLAPSE_DELAY_MS);
  }

  // Collapses a fanned-out group back to its single merged marker: removes
  // the fanned members, re-adds the rest marker, and restores every other
  // marker's visibility (undoing expandGroup's setOtherMarkersHidden call).
  private collapseGroup(group: MarkerGroup) {
    if (group.collapseTimeout) {
      clearTimeout(group.collapseTimeout);
      group.collapseTimeout = null;
    }
    if (!group.fannedMarkers) {
      return;
    }
    this.hideTooltip();
    group.fannedMarkers.forEach((marker) => this.map.removeLayer(marker));
    group.fannedMarkers = null;
    group.restMarker.addTo(this.map);
    this.setOtherMarkersHidden(group, false);
    this.selectPoint();
  }

  // Shows or hides every marker group's marker(s) except `activeGroup` -
  // used to hide the rest of the map's markers while one group is fanned
  // out. Uses opacity/pointer-events rather than removeLayer/addTo.
  private setOtherMarkersHidden(activeGroup: MarkerGroup, hidden: boolean) {
    this.markerGroups
      .filter((group) => group !== activeGroup)
      .forEach((group) => {
        const markers = group.fannedMarkers ?? [group.restMarker];
        markers.forEach((marker) => {
          marker.setOpacity(hidden ? 0 : 1);
          const element = marker.getElement();
          if (element) {
            element.style.pointerEvents = hidden ? 'none' : '';
          }
        });
      });
  }

  private collapseAllGroups() {
    this.markerGroups
      .filter((group) => group.fannedMarkers)
      .forEach((group) => this.collapseGroup(group));
  }

  // selects point to make visually different on map
  selectPoint() {
    this.markerGroups.forEach((group) => {
      const selectedInGroup = group.points.some((point) => point.id === this.selectedPoint());
      if (group.fannedMarkers) {
        group.fannedMarkers.forEach((marker, i) => {
          const isSelected = group.points[i].id === this.selectedPoint();
          marker.getElement()?.classList.toggle('active-marker', isSelected);
        });
      } else {
        group.restMarker.getElement()?.classList.toggle('active-marker', selectedInGroup);
      }
    });
  }
}
