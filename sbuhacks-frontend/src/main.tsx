// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Auth0Provider, type AppState } from '@auth0/auth0-react';
import { AuthProvider } from './contexts/AuthContext';
import App from './App.tsx';
import './index.css';

// Import all pages
import HomePage from './pages/HomePage.tsx';
import EventsListPage from './pages/EventsListPage.tsx';
import EventDetailPage from './pages/EventDetailPage.tsx';
import GlobalChatPage from './pages/GlobalChatPage.tsx';
import MyProfilePage from './pages/MyProfilePage.tsx';
import PublicProfilePage from './pages/PublicProfilePage.tsx';
import CreateEventPage from './pages/CreateEventPage.tsx'; // <-- IMPORT
import AdminPage from './pages/AdminPage.tsx'; // <-- IMPORT

// --- (Auth0 config) ---
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

const onRedirectCallback = (appState: AppState | undefined) => {
  // Use the router to navigate to the saved path, or to the home page
  router.navigate(appState?.returnTo || window.location.pathname, {
    replace: true,
  });
};

if (!auth0Domain || !auth0ClientId || !auth0Audience) {
  throw new Error('Auth0 environment variables are not set!');
}

// --- ONE SINGLE ROUTER DEFINITION ---
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Home is now Events
      { index: true, element: <EventsListPage /> },

      // Keep a route alias so /events still works
      { path: 'events', element: <EventsListPage /> },

      // Use the AI chat (your old HomePage) at /ai
      { path: 'ai', element: <HomePage /> },

      { path: 'event/:eventId', element: <EventDetailPage /> },
      { path: 'chat', element: <GlobalChatPage /> },
      { path: 'profile/me', element: <MyProfilePage /> },
      { path: 'profile/:username', element: <PublicProfilePage /> },
      { path: 'events/new', element: <CreateEventPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      onRedirectCallback={onRedirectCallback}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Audience,
        scope: 'openid profile email',
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Auth0Provider>
  </React.StrictMode>
);