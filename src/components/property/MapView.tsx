"use client";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.divIcon({
  html: '<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#367C59"/><circle cx="14" cy="14" r="6" fill="#F5F4EF"/></svg>',
  className: "",
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

export default function MapView({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  if (!latitude || !longitude) return null;
  const center: [number, number] = [latitude, longitude];
  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Marker position={center} icon={icon} />
      </MapContainer>
    </div>
  );
}
