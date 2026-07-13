# StreamSphere

## Overview

StreamSphere is a polished Netflix-inspired application with a React + Vite frontend and a Spring Boot backend. It serves a curated catalog of fictional movies through REST APIs and presents them in a rich, animated landing experience.

## Features

- Responsive dark-themed Netflix-style landing page
- Hero banner with featured content
- Trending, popular, and continue-watching sections
- Multi-page experience with Home, Discover, My List, and Coming Soon views
- Movie detail modal with synopsis and metadata
- Local watchlist interactions with animated UI feedback
- Dockerized frontend and backend deployment

## Architecture

- Frontend: React + Vite + Nginx
- Backend: Spring Boot 3 + Java 21 + Maven
- Data: Static movie catalog served from JSON
- Deployment: Docker Compose

## API Endpoints

- GET /api/health
- GET /api/version
- GET /api/movies
- GET /api/movies/{id}

## Run Locally

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## Verification

The project was verified with:

- Maven tests for the backend
- Vite production build for the frontend
- Docker Compose configuration validation