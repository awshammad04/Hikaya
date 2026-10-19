# System Architecture

## High-Level Components

Hikaya will include the following main components:

## 1. Frontend

The frontend is the web interface that users interact with.

Main responsibilities:

- Display the interactive map
- Show location details
- Display stories and multimedia
- Provide contribution form
- Connect with backend APIs

## 2. Backend

The backend manages the application logic and connects the frontend with the database and AI module.

Main responsibilities:

- Manage locations
- Manage stories
- Manage user contributions
- Handle AI requests
- Connect with the database

## 3. Database

The database stores project data.

Main data:

- Users
- Locations
- Stories
- Media
- Categories
- User contributions

## 4. AI Module

The AI module supports smart storytelling features.

Main responsibilities:

- Generate simplified stories from reviewed content
- Answer questions through the AI Heritage Guide
- Personalize stories for different audiences
- Analyze user-submitted stories

Important rule:

The AI should not invent historical facts. It should only use reviewed content provided by the system.

## 5. Location Services

Location services are used to display Palestinian locations on the map.

Possible options:

- Google Maps API
- OpenStreetMap
- Leaflet.js

## Basic Data Flow

1. User opens the platform.
2. Frontend requests locations from backend.
3. Backend retrieves location data from database.
4. User selects a location.
5. Backend retrieves related stories and media.
6. AI module generates a simplified story based on reviewed content.
7. Frontend displays the final story to the user.
