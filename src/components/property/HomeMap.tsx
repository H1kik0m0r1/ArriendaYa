"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Property } from "@/lib/types";

const icon = L.divIcon({
  html: '<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#367C59"/><circle cx="14" cy="14" r="6" fill="#F5F4EF"/></svg>',
  className: "",
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

export default function HomeMap({ properties, userLocation }: { properties: Property[]; userLocation: { lat: number; lng: number } | null }) {
  const valid = properties.filter((p) => p.latitude && p.longitude);
  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : (valid.length ? [valid[0].latitude!, valid[0].longitude!] : [4.711, -74.0721]);
  return (
    <div className="h-96 w-full overflow-hidden rounded-lg border border-border">
      <MapContainer center={center} zoom={userLocation ? 11 : 5} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {valid.map((p) => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{p.name}</p>
                <p>{p.location}</p>
                <Link href={`/properties/${p.id}`} className="text-primary hover:underline">Ver más</Link>
              </div>
            </Popup>
          </Marker>
        ))}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({ html: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="#fff" stroke-width="2"/></svg>', className: "", iconSize: [20, 20], iconAnchor: [10, 10] })} />
        )}
      </MapContainer>
    </div>
  );
}
