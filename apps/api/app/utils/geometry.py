import math

from geoalchemy2 import WKTElement
from shapely.geometry import Point, shape
from shapely.wkb import loads as wkb_loads
from shapely.wkt import dumps as wkt_dumps


def point_to_wkt_element(lat: float, lon: float, srid: int = 4326) -> WKTElement:
    """Create a GeoAlchemy2 WKTElement from latitude/longitude."""
    return WKTElement(f"POINT({lon} {lat})", srid=srid)


def wkt_element_to_point(wkt_element: WKTElement) -> Point:
    """Convert a GeoAlchemy2 WKTElement to a Shapely Point."""
    from shapely import wkt as shapely_wkt

    return shapely_wkt.loads(wkt_element.data)


def geojson_to_wkt_element(geojson: dict, srid: int = 4326) -> WKTElement:
    """Convert a GeoJSON geometry dict to a WKTElement."""
    geom = shape(geojson)
    return WKTElement(wkt_dumps(geom), srid=srid)


def wkb_to_latlon(wkb_bytes: bytes) -> tuple[float, float]:
    """Parse WKB binary geometry and return (latitude, longitude)."""
    geom = wkb_loads(wkb_bytes)
    if isinstance(geom, Point):
        return geom.y, geom.x
    centroid = geom.centroid
    return centroid.y, centroid.x


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lon points using the Haversine formula."""
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c
