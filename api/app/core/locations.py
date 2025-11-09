# File: api/app/core/locations.py

# A static lookup for geocoding campus locations
CAMPUS_LOCATIONS = {
    # Libraries
    "melville library": {"lat": 40.9149, "lon": -73.1235, "name": "Melville Library"},
    "librry": {"lat": 40.9149, "lon": -73.1235, "name": "Melville Library"},  # Common typo in your feed
    "chemistry library": {"lat": 40.9138, "lon": -73.1213, "name": "Chemistry Library"},
    "music library": {"lat": 40.9168, "lon": -73.1200, "name": "Music Library"},
    "north reading room": {"lat": 40.9149, "lon": -73.1235, "name": "North Reading Room (Melville)"},
    "central reading room": {"lat": 40.9149, "lon": -73.1235, "name": "Central Reading Room (Melville)"},
    "graduate student lounge": {"lat": 40.9149, "lon": -73.1235, "name": "Graduate Lounge (Melville)"},
    
    # Dining
    "east side dining": {"lat": 40.9127, "lon": -73.1197, "name": "East Side Dining"},
    "west side dining": {"lat": 40.9155, "lon": -73.1264, "name": "West Side Dining (Market)"},
    "sac food court": {"lat": 40.9145, "lon": -73.1219, "name": "SAC Food Court"},

    # SAC (Student Activities Center)
    "sac": {"lat": 40.9145, "lon": -73.1219, "name": "Student Activities Center"},
    "student activities center": {"lat": 40.9145, "lon": -73.1219, "name": "Student Activities Center"},
    "sac ballroom a": {"lat": 40.9145, "lon": -73.1219, "name": "SAC Ballroom A"},
    "sac ballroom b": {"lat": 40.9145, "lon": -73.1219, "name": "SAC Ballroom B"},
    "sac auditorium": {"lat": 40.9145, "lon": -73.1219, "name": "SAC Auditorium"},
    "sac plaza": {"lat": 40.9145, "lon": -73.1219, "name": "SAC Plaza Circle"},
    "sbu pantry": {"lat": 40.9143, "lon": -73.1219, "name": "SBU Pantry (SAC)"},
    "international lounge": {"lat": 40.9145, "lon": -73.1219, "name": "International Lounge (SAC)"},
    "commuter lounge": {"lat": 40.9145, "lon": -73.1219, "name": "Commuter Lounge (SAC)"},

    # Student Union
    "student union": {"lat": 40.9144, "lon": -73.1220, "name": "Student Union Building"},
    "union": {"lat": 40.9144, "lon": -73.1220, "name": "Student Union Building"},
    "interfaith chapel": {"lat": 40.9144, "lon": -73.1220, "name": "Interfaith Chapel (Union)"},

    # Tech Lounges / SINC Sites
    "tech lounge sac": {"lat": 40.9145, "lon": -73.1219, "name": "Tech Lounge (SAC SINC Site)"},
    "tech lounge melville": {"lat": 40.9149, "lon": -73.1235, "name": "Tech Lounge (Melville SINC Site)"},
    "tech lounge ecc": {"lat": 40.9132, "lon": -73.1221, "name": "Tech Lounge (ECC SINC Site)"},

    # Gym/Rec/Athletics
    "campus rec center": {"lat": 40.9103, "lon": -73.1207, "name": "Campus Rec Center"},
    "campus recreation center": {"lat": 40.9103, "lon": -73.1207, "name": "Campus Rec Center"},
    "rec center": {"lat": 40.9103, "lon": -73.1207, "name": "Campus Rec Center"},
    "mac courts": {"lat": 40.9103, "lon": -73.1207, "name": "MAC Courts (Rec Center)"},
    "wood courts": {"lat": 40.9103, "lon": -73.1207, "name": "Wood Courts (Rec Center)"},
    "walter j. hawkins": {"lat": 40.9103, "lon": -73.1207, "name": "Campus Rec Center"},
    "pritchard gymnasium": {"lat": 40.9105, "lon": -73.1205, "name": "Pritchard Gymnasium"},

    # Arenas & Stadiums
    "island federal arena": {"lat": 40.9099, "lon": -73.1202, "name": "Island Federal Arena"},
    "stony brook arena": {"lat": 40.9099, "lon": -73.1202, "name": "Stony Brook Arena"},
    "lavalle stadium": {"lat": 40.9110, "lon": -73.1189, "name": "LaValle Stadium"},
    "kenneth p. lavalle stadium": {"lat": 40.9110, "lon": -73.1189, "name": "Kenneth P. LaValle Stadium"},

    # Fields
    "south field": {"lat": 40.9080, "lon": -73.1200, "name": "South Field A (Turf)"},
    "turf field": {"lat": 40.9080, "lon": -73.1200, "name": "Turf Field A"},
    "physics lawn": {"lat": 40.9130, "lon": -73.1210, "name": "Physics Lawn"},

    # Academic Buildings
    "south p": {"lat": 40.9048, "lon": -73.1264, "name": "South P Lot"},
    "staller": {"lat": 40.9161, "lon": -73.1200, "name": "Staller Center for the Arts"},
    "staller center": {"lat": 40.9161, "lon": -73.1200, "name": "Staller Center for the Arts"},
    "charles b. wang center": {"lat": 40.9155, "lon": -73.1189, "name": "Charles B. Wang Center"},
    "wang center": {"lat": 40.9155, "lon": -73.1189, "name": "Charles B. Wang Center"},
    "javits": {"lat": 40.9132, "lon": -73.1221, "name": "Javits Lecture Center"},
    "javits center": {"lat": 40.9132, "lon": -73.1221, "name": "Javits Lecture Center"},
    "ecc": {"lat": 40.9132, "lon": -73.1221, "name": "Educational Communications Center (ECC)"},
    
    # Residential Quads
    "tabler": {"lat": 40.9170, "lon": -73.1245, "name": "Tabler Quad"},
    
    # Off-campus/External
    "the rinx": {"lat": 40.8274, "lon": -73.2044, "name": "The Rinx (Hauppauge)"},
    "bowlero berks lanes": {"lat": 40.3645, "lon": -75.9258, "name": "Bowlero Berks Lanes (PA)"},
}

def geocode_location(location_name: str):
    """
    Tries to find lat/lon data for a given location name.
    ALWAYS returns a dict with 'name', 'lat', 'lon'.
    
    Handles:
    - Direct matches
    - Partial matches
    - URLs (returns as online)
    - Unknown locations (returns original name with no coords)
    """
    if not location_name:
        return {"name": "Location TBD", "lat": None, "lon": None}

    original_name = location_name.strip()
    search_key = original_name.lower()

    # Handle URLs/Online events
    if search_key.startswith('http://') or search_key.startswith('https://'):
        return {"name": "Online", "lat": None, "lon": None}
    
    if search_key in ['online', 'virtual', 'zoom', 'remote']:
        return {"name": "Online", "lat": None, "lon": None}

    # Try direct match first (fastest)
    if search_key in CAMPUS_LOCATIONS:
        result = CAMPUS_LOCATIONS[search_key].copy()
        result['name'] = original_name  # Keep original capitalization
        return result

    # Try partial match (e.g., "SAC Ballroom A" contains "sac")
    # Sort by key length descending to match longest/most specific first
    sorted_keys = sorted(CAMPUS_LOCATIONS.keys(), key=len, reverse=True)
    
    for key in sorted_keys:
        if key in search_key:
            result = CAMPUS_LOCATIONS[key].copy()
            result['name'] = original_name  # Keep original name for display
            return result
    
    # No match found - return original name with no coordinates
    # The frontend should handle null coords gracefully
    print(f"  ⚠️  Unknown location (no geocoding): '{original_name}'")
    return {"name": original_name, "lat": None, "lon": None}


def add_location(key: str, lat: float, lon: float, display_name: str):
    """
    Helper to add new locations to the lookup dynamically.
    Useful for testing or extending the location database.
    """
    CAMPUS_LOCATIONS[key.lower()] = {
        "lat": lat, 
        "lon": lon, 
        "name": display_name
    }