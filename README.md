# Project: Lazy Creator

## Project Overview

Lazy Creator is a full-stack web application designed to automate the creation of YouTube Shorts using AI. It features a React-based frontend for user interaction and a Python backend that handles video generation, YouTube integration, and file storage.

**Frontend:**

*   **Framework:** React with Vite and TypeScript
*   **Styling:** Tailwind CSS with Shadcn/UI components
*   **Authentication:** Firebase
*   **Key Libraries:**
    *   `@tanstack/react-query` for server state management
    *   `react-router-dom` for routing
    *   `framer-motion` for animations
    *   `socket.io-client` for real-time communication

**Backend:**

*   **Framework:** Python with Flask
*   **Database:** MongoDB
*   **Cloud Services:**
    *   Google Cloud Storage for media file storage
    *   YouTube Data API v3 for video uploading
*   **Key Libraries:**
    *   `google-api-python-client` for YouTube integration
    *   `google-cloud-storage` for file storage
    *   `ffmpeg-python` for video processing
    *   `PyJWT` for authentication

## Building and Running

### Frontend

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Configure environment variables:**

    Create a `.env.local` file in the `frontend` directory and add the following:

    ```
    VITE_API_URL=http://localhost:4000
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_app.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```

### Backend

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
2.  **Configure environment variables:**

    Create a `.env` file in the `backend/app` directory and add the following:

    ```
    FLASK_APP=main.py
    FLASK_ENV=development
    SECRET_KEY=your-secret-key
    MONGODB_URI=your_mongodb_uri
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/google-credentials.json
    YOUTUBE_CLIENT_SECRETS=/path/to/your/client_secret.json
    FRONTEND_URL=http://localhost:3500
    ```
3.  **Run the application:**
    ```bash
    python -m app.main
    ```

## Development Conventions

*   **Frontend:**
    *   Follows atomic design principles for component structure.
    *   Uses custom hooks for reusable logic.
    *   Employs React Context for global state management.
*   **Backend:**
    *   Uses a modular structure with blueprints for different features.
    *   Implements JWT-based authentication with a token refresh mechanism.
    *   Handles video generation in background threads to avoid blocking the main application.
*   **General:**
    *   The project uses separate `README.md` files for the frontend and backend, which should be consulted for more detailed information.
