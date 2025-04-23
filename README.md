# LazyCreator - Automated YouTube Shorts Creation Platform

LazyCreator is a full-stack application designed to automate the creation of YouTube Shorts. It combines modern frontend technologies with powerful backend services to provide a seamless user experience for content creation.

## Features

- 🎥 Automated video generation for YouTube Shorts
- 🎨 Customizable video styles and backgrounds
- 🔊 AI-powered voiceover generation
- 📱 Responsive design that works on all devices
- 🌓 Dark/light theme support
- 🔐 Secure authentication with Firebase
- 📤 Direct YouTube upload integration

## Project Structure

- `frontend/` - React-based web application
- `backend/` - Python Flask API server
- `docs/` - Additional documentation

## Prerequisites

- Node.js 18+ for frontend
- Python 3.10+ for backend
- MongoDB database
- Google Cloud account for storage
- Firebase project for authentication

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/yourusername/lazy-creator.git
cd lazy-creator
```

2. Set up the backend:

```bash
cd backend
pip install -r requirements.txt
# Configure environment variables (see backend/README_SETUP.md)
python app/main.py
```

3. Set up the frontend:

```bash
cd frontend
npm install
# Configure environment variables (see frontend/README_SETUP.md)
npm run dev
```

## Environment Variables

### Backend

Create a `.env` file in the `backend` directory:

```
MONGODB_URI=your_mongodb_uri
SECRET_KEY=your_secret_key
GOOGLE_APPLICATION_CREDENTIALS=path_to_credentials.json
MEDIA_BUCKET=your_media_bucket_name
UPLOADS_BUCKET=your_uploads_bucket_name
```

### Frontend

Create a `.env` file in the `frontend` directory:

```
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_CONFIG=your_firebase_config
```

## Development

- Frontend runs on port 3500 (http://localhost:3500)
- Backend runs on port 4000 (http://localhost:4000)
- Use `npm run dev` for frontend development
- Use `python app/main.py` for backend development

## Testing

- Frontend: `npm run test`
- Backend: `python -m pytest`

## Deployment

### Frontend

- Built with Vite
- Deploy to Vercel or similar platforms
- Run `npm run build` for production build

### Backend

- Deploy using Docker
- Configure with environment variables
- Supports cloud platform deployment (GCP, AWS, etc.)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
