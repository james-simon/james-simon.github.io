// Default event list, loaded on first visit (or after "Reset to sample").
// Once you edit the textarea, your version is saved to localStorage and wins.
window.FRINGE_SAMPLE = {
  "meta": {
    "date": "2026-08-29",
    "day": "Saturday",
    "city": "Edinburgh",
    "count": 25,
    "notes": "Coordinates are venue-level (building entrance), WGS84 decimal degrees. `venue.confidence` flags how sure the venue resolution is: high = address confirmed, medium = venue known but room/building slightly ambiguous, low = the listing was ambiguous and a default was assumed.",
    "schema": {
      "id": "stable slug, safe as a map marker key",
      "start/end": "ISO 8601 local time, no timezone (Europe/London)",
      "sessions": "present only when the show has multiple time options that day",
      "status": "your pick state - 'candidate' by default; suggest 'yes' | 'maybe' | 'no'"
    }
  },
  "shows": [
    {
      "id": "one-british-one-immigrant",
      "name": "1 British, 1 Immigrant",
      "genre": "comedy",
      "start": "2026-08-29T10:00",
      "end": "2026-08-29T11:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "lh-counting-house",
        "name": "Laughing Horse @ The Counting House",
        "room": "Garden Room",
        "address": "38 West Nicolson Street, EH8 9DD",
        "lat": 55.94378,
        "lng": -3.18564,
        "confidence": "high"
      }
    },
    {
      "id": "spring-awakening",
      "name": "Spring Awakening",
      "genre": "musical",
      "start": "2026-08-29T10:00",
      "end": "2026-08-29T11:40",
      "durationMin": 100,
      "status": "candidate",
      "venue": {
        "id": "space-surgeons-hall",
        "name": "theSpace @ Surgeons' Hall",
        "room": "Grand Theatre",
        "address": "Nicolson Street, EH8 9DW",
        "lat": 55.94643,
        "lng": -3.18497,
        "confidence": "high"
      }
    },
    {
      "id": "anyone-fancy-a-bagel",
      "name": "Anyone Fancy a Bagel",
      "genre": "comedy",
      "start": "2026-08-29T10:15",
      "end": "2026-08-29T11:15",
      "durationMin": 60,
      "status": "candidate",
      "note": "Listing just said 'Laughing Horse' - assumed The Counting House (their main multi-room venue). Verify room.",
      "venue": {
        "id": "lh-counting-house",
        "name": "Laughing Horse @ The Counting House",
        "room": null,
        "address": "38 West Nicolson Street, EH8 9DD",
        "lat": 55.94378,
        "lng": -3.18564,
        "confidence": "low"
      }
    },
    {
      "id": "around-the-world-in-80-toys",
      "name": "Around the World in 80 Toys",
      "genre": "theatre",
      "start": "2026-08-29T10:15",
      "end": "2026-08-29T11:15",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "summerhall",
        "name": "Summerhall",
        "room": "Anatomy Lecture Theatre",
        "address": "1 Summerhall, EH9 1PL",
        "lat": 55.9401,
        "lng": -3.18063,
        "confidence": "high"
      }
    },
    {
      "id": "apples-in-winter",
      "name": "Apples in Winter",
      "genre": "theatre",
      "blurb": "Mother makes apple pie for her son on death row",
      "start": "2026-08-29T10:30",
      "end": "2026-08-29T11:30",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "paradise-vault-annexe",
        "name": "Paradise in The Vault",
        "room": "The Annexe",
        "address": "11 Merchant Street, EH1 2QD",
        "lat": 55.94749,
        "lng": -3.19073,
        "confidence": "high"
      }
    },
    {
      "id": "yesyesnono",
      "name": "YESYESNONO",
      "genre": "theatre",
      "start": "2026-08-29T10:40",
      "end": "2026-08-29T11:45",
      "durationMin": 65,
      "status": "candidate",
      "venue": {
        "id": "summerhall",
        "name": "Summerhall",
        "room": "Main Hall",
        "address": "1 Summerhall, EH9 1PL",
        "lat": 55.9401,
        "lng": -3.18063,
        "confidence": "high"
      }
    },
    {
      "id": "broadguess",
      "name": "Broadguess",
      "genre": "comedy",
      "blurb": "Shakespeare x murder mystery parody",
      "start": "2026-08-29T10:45",
      "end": "2026-08-29T11:45",
      "durationMin": 60,
      "status": "candidate",
      "note": "Listing just said 'Laughing Horse' - assumed The Counting House. Verify room.",
      "venue": {
        "id": "lh-counting-house",
        "name": "Laughing Horse @ The Counting House",
        "room": null,
        "address": "38 West Nicolson Street, EH8 9DD",
        "lat": 55.94378,
        "lng": -3.18564,
        "confidence": "low"
      }
    },
    {
      "id": "absolute-bus-stops",
      "name": "Absolute Bus Stops",
      "genre": "comedy",
      "start": "2026-08-29T10:50",
      "end": "2026-08-29T11:40",
      "durationMin": 50,
      "status": "candidate",
      "venue": {
        "id": "paradise-augustines",
        "name": "Paradise in Augustines",
        "room": "The Sanctuary",
        "address": "41 George IV Bridge, EH1 1EL",
        "lat": 55.9478,
        "lng": -3.1919,
        "confidence": "high"
      }
    },
    {
      "id": "one-liner-comedians",
      "name": "1 Liner Comedians",
      "genre": "comedy",
      "start": "2026-08-29T12:00",
      "end": "2026-08-29T13:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "lh-dropkick-murphys",
        "name": "Laughing Horse @ Dropkick Murphys",
        "room": null,
        "address": "7 Merchant Street, EH1 2QD",
        "lat": 55.94742,
        "lng": -3.19035,
        "confidence": "high"
      }
    },
    {
      "id": "five-mistakes-that-changed-history",
      "name": "5 Mistakes That Changed History",
      "performer": "Paul Coulter",
      "genre": "spoken word",
      "start": "2026-08-29T12:40",
      "end": "2026-08-29T13:40",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "assembly-george-square",
        "name": "Assembly George Square",
        "room": "Gordon Aikman Theatre",
        "address": "George Square, EH8 9LH",
        "lat": 55.94276,
        "lng": -3.18727,
        "confidence": "medium"
      }
    },
    {
      "id": "58-to-go",
      "name": "58 to Go",
      "genre": "theatre",
      "start": "2026-08-29T12:40",
      "end": "2026-08-29T13:40",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "greenside-george-street",
        "name": "Greenside @ George Street",
        "room": "Jade Studio",
        "address": "Royal Society of Edinburgh, 22-26 George Street, EH2 2PQ",
        "lat": 55.95347,
        "lng": -3.19527,
        "confidence": "high"
      }
    },
    {
      "id": "zero-percent-moisture",
      "name": "0% Moisture",
      "genre": "comedy",
      "start": "2026-08-29T12:45",
      "end": "2026-08-29T13:45",
      "durationMin": 60,
      "status": "candidate",
      "note": "Listing just said 'Laughing Horse' - assumed The Counting House. Verify room.",
      "venue": {
        "id": "lh-counting-house",
        "name": "Laughing Horse @ The Counting House",
        "room": null,
        "address": "38 West Nicolson Street, EH8 9DD",
        "lat": 55.94378,
        "lng": -3.18564,
        "confidence": "low"
      }
    },
    {
      "id": "2-muslim-2-furious-3",
      "name": "2 Muslim 2 Furious 3: Sharia? I Hardly Know Her",
      "genre": "comedy",
      "start": "2026-08-29T13:00",
      "end": "2026-08-29T14:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "lh-counting-house",
        "name": "Laughing Horse @ The Counting House",
        "room": "The Ballroom",
        "address": "38 West Nicolson Street, EH8 9DD",
        "lat": 55.94378,
        "lng": -3.18564,
        "confidence": "high"
      }
    },
    {
      "id": "man-proposes-to-a-balloon",
      "name": "A Man Proposes to a Balloon, or Possibly Something Worse",
      "genre": "comedy",
      "start": "2026-08-29T13:00",
      "end": "2026-08-29T14:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "gb-patter-house",
        "name": "Gilded Balloon Patter House",
        "room": "Blether",
        "address": "Chambers Street, EH1 1HR",
        "lat": 55.94786,
        "lng": -3.1888,
        "confidence": "medium"
      }
    },
    {
      "id": "30-and-fcked",
      "name": "30 and F*cked",
      "genre": "comedy",
      "start": "2026-08-29T15:20",
      "end": "2026-08-29T16:10",
      "durationMin": 50,
      "status": "candidate",
      "venue": {
        "id": "gb-teviot",
        "name": "Gilded Balloon Teviot",
        "room": "Nook",
        "address": "Teviot Row House, 13 Bristo Square, EH8 9AJ",
        "lat": 55.94508,
        "lng": -3.18853,
        "confidence": "high"
      }
    },
    {
      "id": "candace-bryan",
      "name": "Candace Bryan: Don't Be Ridiculous, Everybody Wants This",
      "genre": "comedy",
      "start": "2026-08-29T16:00",
      "end": "2026-08-29T17:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "gb-patter-house",
        "name": "Gilded Balloon Patter House",
        "room": "Bothie",
        "address": "Chambers Street, EH1 1HR",
        "lat": 55.94786,
        "lng": -3.1888,
        "confidence": "medium"
      }
    },
    {
      "id": "one-hour-of-insanity",
      "name": "1 Hour of Insanity",
      "genre": "magic / circus / comedy",
      "start": "2026-08-29T16:35",
      "end": "2026-08-29T17:35",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "gb-patter-house",
        "name": "Gilded Balloon Patter House",
        "room": "Other Yin",
        "address": "Chambers Street, EH1 1HR",
        "lat": 55.94786,
        "lng": -3.1888,
        "confidence": "medium"
      }
    },
    {
      "id": "gianmarco-soresi",
      "name": "Gianmarco Soresi: Theater Adult",
      "genre": "comedy",
      "start": "2026-08-29T19:40",
      "end": "2026-08-29T20:40",
      "durationMin": 60,
      "status": "candidate",
      "note": "Cowbarn is an Underbelly Bristo Square room - double-check it isn't the George Square site.",
      "venue": {
        "id": "underbelly-bristo-square",
        "name": "Underbelly, Bristo Square",
        "room": "Cowbarn",
        "address": "Bristo Square, EH8 9AL",
        "lat": 55.94459,
        "lng": -3.18734,
        "confidence": "medium"
      }
    },
    {
      "id": "heated-rivalry",
      "name": "Heated Rivalry: The Musical Parody",
      "genre": "musical parody",
      "start": "2026-08-29T19:50",
      "end": "2026-08-29T21:00",
      "durationMin": 70,
      "status": "candidate",
      "venue": {
        "id": "underbelly-george-square",
        "name": "Underbelly, George Square",
        "room": "Udderbelly",
        "address": "George Square Gardens, EH8 9LH",
        "lat": 55.94282,
        "lng": -3.18901,
        "confidence": "high"
      }
    },
    {
      "id": "spencer-jones-dogs",
      "name": "Spencer Jones: Dogs",
      "genre": "comedy",
      "start": "2026-08-29T20:15",
      "end": "2026-08-29T21:15",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "pleasance-dome",
        "name": "Pleasance Dome",
        "room": "Queen Dome",
        "address": "1 Bristo Square, EH8 9AL",
        "lat": 55.94478,
        "lng": -3.1867,
        "confidence": "high"
      }
    },
    {
      "id": "tom-towelling-knit",
      "name": "Tom Towelling Teaches You to Knit",
      "genre": "comedy",
      "start": "2026-08-29T20:30",
      "end": "2026-08-29T21:30",
      "durationMin": 60,
      "status": "candidate",
      "sessions": [
        {
          "start": "2026-08-29T20:30",
          "end": "2026-08-29T21:30"
        },
        {
          "start": "2026-08-29T21:45",
          "end": "2026-08-29T22:45"
        }
      ],
      "venue": {
        "id": "pleasance-courtyard",
        "name": "Pleasance Courtyard",
        "room": "Attic",
        "address": "60 Pleasance, EH8 9TJ",
        "lat": 55.94826,
        "lng": -3.18134,
        "confidence": "high"
      }
    },
    {
      "id": "tia-rey",
      "name": "Tia Rey: Oot Ma Banger",
      "genre": "comedy",
      "start": "2026-08-29T21:00",
      "end": "2026-08-29T22:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "gilded-saloon",
        "name": "The Gilded Saloon",
        "room": "Basement",
        "address": "45-47 Lothian Street, EH1 1HB",
        "lat": 55.94654,
        "lng": -3.18884,
        "confidence": "high"
      }
    },
    {
      "id": "best-of-scottish-comedy",
      "name": "Best of Scottish Comedy",
      "genre": "comedy",
      "start": "2026-08-29T21:10",
      "end": "2026-08-29T22:40",
      "durationMin": 90,
      "status": "candidate",
      "venue": {
        "id": "the-stand-3-4",
        "name": "The Stand Comedy Club 3 & 4",
        "room": null,
        "address": "28 York Place, EH1 3EP",
        "lat": 55.95602,
        "lng": -3.18966,
        "confidence": "high"
      }
    },
    {
      "id": "landlords-wet-dream",
      "name": "Landlord's Wet Dream",
      "genre": "comedy",
      "start": "2026-08-29T22:15",
      "end": "2026-08-29T23:15",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "underbelly-bristo-square",
        "name": "Underbelly, Bristo Square",
        "room": "Daisy",
        "address": "Bristo Square, EH8 9AL",
        "lat": 55.94459,
        "lng": -3.18734,
        "confidence": "high"
      }
    },
    {
      "id": "dom-mcgovern-prize-hog",
      "name": "Dom McGovern: Prize Hog",
      "genre": "comedy",
      "start": "2026-08-29T23:00",
      "end": "2026-08-30T00:00",
      "durationMin": 60,
      "status": "candidate",
      "venue": {
        "id": "pleasance-courtyard",
        "name": "Pleasance Courtyard",
        "room": "Bunker One",
        "address": "60 Pleasance, EH8 9TJ",
        "lat": 55.94826,
        "lng": -3.18134,
        "confidence": "high"
      }
    }
  ]
};
