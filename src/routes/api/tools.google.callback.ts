import { createServerFileRoute } from '@tanstack/react-start/server'
import { google } from 'googleapis'

export const ServerRoute = createServerFileRoute('/api/tools/google/callback').methods({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state') // organizationId
      
      if (!code || !state) {
        return new Response(
          `<html><body><h1>Error</h1><p>Missing authorization code or state</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' }, status: 400 }
        )
      }
      
      // Exchange code for tokens (similar to HubSpot)
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/google/callback`
      )
      
      const { tokens } = await oauth2Client.getToken(code)
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google')
      }
      
      // Get user info
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()
      
      // Return naming page (similar to HubSpot)
      return new Response(
        `<html>
          <head>
            <title>Name Your Google Calendar Connection</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; }
              .form-group { margin-bottom: 20px; }
              label { display: block; margin-bottom: 8px; font-weight: 500; }
              input, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; }
              button { background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; }
              button:hover { background: #3367d6; }
              .account-info { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>Name Your Google Calendar Connection</h1>
            
            <div class="account-info">
              <strong>Connected Account:</strong> ${userInfo.email}<br>
              <strong>Google ID:</strong> ${userInfo.id}
            </div>
            
            <form id="namingForm">
              <div class="form-group">
                <label for="displayName">Connection Name *</label>
                <input 
                  type="text" 
                  id="displayName" 
                  placeholder="e.g., CEO Calendar, Sales Calendar, Team Calendar"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="description">Description (optional)</label>
                <textarea 
                  id="description" 
                  placeholder="e.g., Executive scheduling, Sales demos, Team meetings"
                  rows="3"
                ></textarea>
              </div>
              
              <button type="submit">Save Connection</button>
            </form>
            
            <script>
              document.getElementById('namingForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const displayName = document.getElementById('displayName').value;
                const description = document.getElementById('description').value;
                
                if (!displayName.trim()) {
                  alert('Please enter a connection name');
                  return;
                }
                
                try {
                  const response = await fetch('/api/tools/google/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organizationId: '${state}',
                      displayName: displayName.trim(),
                      description: description.trim(),
                      tokens: ${JSON.stringify(tokens)},
                      userInfo: ${JSON.stringify(userInfo)}
                    })
                  });
                  
                  if (response.ok) {
                    window.opener?.postMessage({ type: 'google_oauth_success' }, '*');
                    window.close();
                  } else {
                    throw new Error('Failed to save connection');
                  }
                } catch (error) {
                  alert('Failed to save connection: ' + error.message);
                }
              });
            </script>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
      
    } catch (error) {
      console.error('Google OAuth callback error:', error)
      
      return new Response(
        `<html>
          <body>
            <h1>Connection Failed</h1>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <script>
              // Close the popup window
              window.opener?.postMessage({ type: 'google_oauth_error', error: '${error instanceof Error ? error.message : 'Unknown error'}' }, '*');
              window.close();
            </script>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      )
    }
  }
})