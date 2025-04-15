# YouTube OAuth Debugging Guide

## Common OAuth Redirect Issues

The most common reason for OAuth redirect failures is a mismatch between:

1. The redirect URI configured in Google Cloud Console
2. The redirect URI used in the OAuth flow request

## Step 1: Check Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to APIs & Services > Credentials
4. Find your OAuth 2.0 Client ID (Web application type)
5. Check the "Authorized redirect URIs" section

Ensure the following URIs are included:

- `http://localhost:3500/youtube-auth-success` (for development)
- `https://your-production-domain.com/youtube-auth-success` (for production)
- `http://localhost:3500/api/youtube-auth-callback` (optional - if your approach uses backend callback)
- `https://your-production-domain.com/api/youtube-auth-callback` (optional - for production)

**Important**:

- The URIs must match EXACTLY (including http/https, trailing slashes, etc.)
- You cannot use IP addresses like 127.0.0.1 in place of localhost

## Step 2: Check Your Frontend Code

In `connectYouTube` function in `gallery.tsx`:

```typescript
// Make sure this matches one of the URIs configured in Google Cloud Console
const redirectUri = `${window.location.origin}/youtube-auth-success`;
```

## Step 3: Check Backend Code

In `main.py`, check the `start_youtube_auth` endpoint:

```python
# This should match one of the URIs configured in Google Cloud Console
redirect_uri = f"{frontend_url}/youtube-auth-success"
```

## Step 4: Check Environment Variables

Make sure `FRONTEND_URL` in `.env` matches your actual frontend URL:

```
FRONTEND_URL=http://localhost:3500
```

For production, this should be your production URL:

```
FRONTEND_URL=https://your-production-domain.com
```

## Step 5: Debug Logs to Check

When you click "Connect to YouTube", look for these console logs (in browser dev tools):

- "Current origin: http://localhost:3500"
- "Using redirect URI: http://localhost:3500/youtube-auth-success"
- "YouTube Auth URL: https://accounts.google.com/o/oauth2/..."

In the backend logs, look for:

- "Starting YouTube OAuth flow with redirect_uri: http://localhost:3500/youtube-auth-success"
- "Authorization URL: https://accounts.google.com/o/oauth2/..."

## Step 6: Testing the OAuth Flow

1. Click "Connect to YouTube" button
2. Check browser console for the logs
3. Check if the auth URL includes the correct `redirect_uri` parameter:
   ```
   redirect_uri=http%3A%2F%2Flocalhost%3A3500%2Fyoutube-auth-success
   ```
4. Check that the URL you're redirected to matches the authorized URI

## Step 7: Fix for client_secret.json

1. Make sure your client_secret.json has the correct "web" configuration:

```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": [
      "http://localhost:3500/youtube-auth-success",
      "http://localhost:3500/api/youtube-auth-callback"
    ],
    "javascript_origins": ["http://localhost:3500"]
  }
}
```

2. In the `.env` file, make sure the path to client_secret.json is correct:

```
YOUTUBE_CLIENT_SECRETS=client_secret.json
```

## Common Errors and Solutions

### "redirect_uri_mismatch"

**Error Message**: The redirect URI in the request, http://example.com, does not match the ones authorized for the OAuth client.

**Solution**: Add the exact URI to your OAuth credentials in Google Cloud Console.

### "invalid_client"

**Error Message**: The OAuth client was not found.

**Solution**: Check your client_secret.json file to ensure it's the correct one for this project.

### "Error creating auth flow"

**Solution**: Check if the client_secret.json file exists and is accessible.

## Verifying the Fix

After making these changes:

1. Restart your backend server
2. Clear browser cookies and cache for your domain
3. Try the "Connect to YouTube" flow again
4. Check the browser and backend console logs
5. If redirected correctly, you should see "Successfully connected to YouTube!" message
