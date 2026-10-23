import type { StyleSpecification } from "maplibre-gl";

// The site's tokens (src/app/globals.css). MapLibre paints on a canvas, so it cannot read CSS variables.
const CANVAS = "#f4f5f7";
const SURFACE = "#ffffff";
const LINE = "#e3e6eb";
const LINE_SOFT = "#eef0f3";
const MUTED = "#525c6b";
// The accent (#f0533b) at 45 %, for the pitches' outline.
const ACCENT_LINE = "rgba(240, 83, 59, 0.45)";
const ACCENT_SOFT = "#fde9e5";
// Two tints the palette lacks, kept close to its greys.
const PARK = "#e7ede8";
const WATER = "#dde5ee";

const polygon = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const line = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const roadClass = (...classes: string[]) => ["all", line, ["match", ["get", "class"], classes, true, false]];
const MINOR = ["minor", "service", "track"];
const MAJOR = ["primary", "secondary", "tertiary", "trunk", "motorway"];
// Road widths grow with the zoom; the map sits around zoom 15.
const width = (at14: number, at18: number) => ["interpolate", ["exponential", 1.6], ["zoom"], 14, at14, 18, at18];

/**
 * A quiet street map in the site's colours on OpenFreeMap's vector tiles (OpenMapTiles schema, no API key):
 * grey blocks, white streets, sports pitches in the accent and only the street names as labels.
 */
export const mapStyle = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": CANVAS } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", filter: polygon, paint: { "fill-color": PARK } },
    {
      id: "green",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["all", polygon, ["match", ["get", "class"], ["grass", "wood", "farmland"], true, false]],
      paint: { "fill-color": PARK },
    },
    {
      id: "pitch",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["all", polygon, ["match", ["get", "class"], ["pitch", "stadium", "track"], true, false]],
      paint: { "fill-color": ACCENT_SOFT, "fill-outline-color": ACCENT_LINE },
    },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", filter: polygon, paint: { "fill-color": WATER } },
    {
      id: "building",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      paint: { "fill-color": LINE_SOFT, "fill-outline-color": LINE },
    },
    {
      id: "road-path",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadClass("path"),
      paint: { "line-color": LINE, "line-width": width(0.6, 2), "line-dasharray": [2, 1.5] },
    },
    {
      id: "road-minor-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadClass(...MINOR),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": LINE, "line-width": width(3, 16) },
    },
    {
      id: "road-major-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadClass(...MAJOR),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": LINE, "line-width": width(5, 26) },
    },
    {
      id: "road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadClass(...MINOR),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": SURFACE, "line-width": width(2, 13) },
    },
    {
      id: "road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadClass(...MAJOR),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": SURFACE, "line-width": width(4, 22) },
    },
    {
      id: "street-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      filter: ["match", ["get", "class"], [...MINOR, ...MAJOR], true, false],
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
      },
      paint: { "text-color": MUTED, "text-halo-color": SURFACE, "text-halo-width": 1.5 },
    },
  ],
} as StyleSpecification;
