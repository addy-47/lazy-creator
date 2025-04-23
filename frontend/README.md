# LazyCreator Frontend

A modern React application for creating and managing YouTube Shorts, built with Vite, TypeScript, and Tailwind CSS.

## Tech Stack

- React 18+
- TypeScript
- Vite
- Tailwind CSS
- ShadcnUI Components
- Firebase Authentication
- React Router
- Tanstack Query
- Framer Motion
- Socket.IO Client

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions and APIs
│   ├── pages/          # Route components
│   └── utils/          # Helper functions
├── public/             # Static assets
└── package.json        # Dependencies and scripts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. Start development server:

```bash
npm run dev
```

## Features

### Core Functionality

- Video creation wizard
- YouTube integration
- Gallery management
- Real-time progress tracking
- Background customization
- Duration control

### User Interface

- Responsive design
- Dark/light theme
- Smooth animations
- Interactive forms
- Toast notifications
- Loading states
- Error handling

### Authentication

- Firebase integration
- Protected routes
- Persistent sessions
- OAuth support

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

### Code Organization

- Components follow atomic design principles
- Custom hooks for reusable logic
- Context for global state
- Type-safe API interactions
- Consistent error handling

### Styling

- Tailwind CSS for styling
- Custom theme configuration
- Responsive design utilities
- Component-specific styles
- Animation utilities

### State Management

- React Context for auth state
- Tanstack Query for server state
- Local storage for preferences
- URL state for navigation

## Production Build

1. Build the application:

```bash
npm run build
```

2. Preview the build:

```bash
npm run preview
```

3. Deploy the `dist` directory to your hosting service

## Performance

- Code splitting
- Lazy loading
- Image optimization
- Caching strategies
- Performance monitoring

## Testing

- Component testing with Jest
- E2E testing with Cypress
- Accessibility testing
- Mobile responsiveness
- Cross-browser compatibility

## Best Practices

- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Git hooks (husky)
- Conventional commits

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Contributing

1. Follow the style guide
2. Write meaningful commit messages
3. Add proper documentation
4. Test your changes
5. Submit pull request

## License

This project is licensed under the MIT License.
