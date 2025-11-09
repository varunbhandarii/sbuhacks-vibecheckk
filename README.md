# SBU VibeCheck
### Stony Brook University's Real-Time Event & Campus "Vibe" Radar

Students say SBU is quiet; we prove what’s actually popping—right now. SBU VibeCheck aggregates every campus event and crowdsources the live "vibe" of events and popular campus spaces (like libraries, dining halls, and gyms) so you know if it’s worth the trip.

*This project was built in 36 hours for **SBUHacks 2025**.*

---

## 🚀 What it Does

* **Real-Time "Vibe" Radar:** See the live vibe (e.g., "Empty," "Lively," "Packed") of events and campus spaces, updated instantly via WebSockets.
* **Contextual Vibe Questions:** We ask smart questions. For a **tech talk**, we ask "Seats left?" For a **soccer game**, we ask "Energy right now?" For a **free food** event, we ask "Food left?"
* **AI-Powered Chat (Gemini):** A chat interface that lets you find events by asking natural language questions like, "What's fun and has free food this weekend?"
* **Social & Community Features:**
    * RSVP (publicly or privately) and see a list of public attendees.
    * Upload event photos directly from your phone.
    * Leave event feedback (ratings & reviews) after an event ends.
    * Create a public user profile with a unique username.
* **Event Creation:** A protected route for "organizer" role accounts to create new events with banner images.

---

## 💻 Tech Stack

| Area | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), TypeScript, Tailwind CSS |
| **Backend** | FastAPI (Python), SQLAlchemy |
| **Database** | Neon (Serverless Postgres) |
| **Real-time** | FastAPI WebSockets |
| **AI** | Google Gemini API (Function Calling) |
| **Authentication** | Auth0 (gated to `@stonybrook.edu`) |
| **File Storage** | Cloudinary (Signed Uploads) |
| **Deployment** | Cloudflare Pages (Frontend), Google Cloud Run (Backend) |

---

## 📁 Project Structure

This repository contains both the frontend and backend applications.

```
.
├── api/         # The FastAPI backend
└── sbuhacks-frontend/    # The React (Vite) frontend
```

---

## 🛠️ How to Run (Local Development)

### Prerequisites

* Node.js v18+
* Python 3.10+
* Poetry (for Python dependencies)
* A running PostgreSQL database (e.g., a free tier on [Neon](https://neon.tech/))

---

### 1. Backend (`/api`)

1.  **Navigate to the backend:**
    ```bash
    cd api
    ```

2.  **Create your environment file:**
    * Copy the example and fill in your secrets.
    ```bash
    cp .env.example .env
    ```
    * *(See "Environment Variables" section below for details)*

3.  **Install dependencies:**
    ```bash
    poetry install
    ```

4.  **Run database migrations (if applicable):**
    ```bash
    poetry run alembic upgrade head
    ```

5.  **Run the server:**
    ```bash
    poetry run uvicorn app.main:app --reload
    ```
    * The backend will be running at `http://localhost:8000`

---

### 2. Frontend (`/frontend`)

1.  **Navigate to the frontend (in a *new terminal*):**
    ```bash
    cd frontend
    ```

2.  **Create your local environment file:**
    * Copy the example and fill in your secrets.
    ```bash
    cp .env.local.example .env.local
    ```
    * *(See "Environment Variables" section below for details)*

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Run the app:**
    ```bash
    npm run dev
    ```
    * The frontend will be running at `http://localhost:5173`

---

## 🔑 Environment Variables

You must create these two files for the project to run.

### `/api/.env` (Backend)

```ini
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/dbname

# Auth0
AUTH0_DOMAIN="your-tenant.us.auth0.com"
AUTH0_AUDIENCE="https://your-api-identifier"

# Google Gemini
GEMINI_API_KEY="your-google-ai-studio-key"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Admin
X_ADMIN_KEY="your-secret-password-to-promote-users"
```

### `/frontend/.env.local` (Frontend)

```ini
# Backend URLs
VITE_API_BASE_URL="http://localhost:8000"
VITE_WS_BASE_URL="ws://localhost:8000"

# Auth0
VITE_AUTH0_DOMAIN="your-tenant.us.auth0.com"
VITE_AUTH0_CLIENT_ID="your-auth0-application-client-id"
VITE_AUTH0_AUDIENCE="https://your-api-identifier"

# Cloudinary (Must match backend)
VITE_CLOUDINARY_CLOUD_NAME="your-cloud-name"
VITE_CLOUDINARY_API_KEY="your-cloudinary-api-key"
VITE_CLOUDINARY_UPLOAD_PRESET="sbuhacks_preset" # Or your preset name
```

---
