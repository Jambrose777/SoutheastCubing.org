import {
  Component,
  input,
  OnInit,
  output,
  SimpleChanges,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import * as L from 'leaflet';
import { MapPoint } from 'src/app/models/Map';

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
  hoverPoint = output<string>();
  clickPoint = output<string>();

  map;
  markers: { point: MapPoint; marker: any }[] = [];

  constructor() {}

  ngOnInit(): void {
    // setup base map
    this.map = L.map('se-map').setView([31.5, -84], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    // add point markers to map
    this.points().forEach((point) => {
      this.createMarker(point);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // changes to selectedPoint
    if (changes['selectedPoint']) {
      this.selectPoint();
    }
  }

  createMarker(point: MapPoint) {
    // create marker
    const marker = L.marker([point.lat, point.long]).addTo(this.map);

    // set marker color
    if (point.colorClass) {
      marker._icon.classList.add(point.colorClass);
    }

    // interaction events
    marker.on('mouseover', () => {
      this.hoverPoint.emit(point.id);
    });
    marker.on('mouseout', () => {
      this.hoverPoint.emit(undefined);
    });
    marker.on('click', () => {
      this.clickPoint.emit(point.id);
    });

    this.markers.push({ point, marker });
  }

  // selects point to make visually different on map
  selectPoint() {
    this.markers.forEach((marker) => {
      if (marker.point.id === this.selectedPoint()) {
        marker.marker._icon.classList.add('active-marker');
      } else {
        marker.marker._icon.classList.remove('active-marker');
      }
    });
  }
}
