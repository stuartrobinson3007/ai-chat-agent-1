import { createServerFileRoute } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute('/api/tools/hubspot/callback').methods({
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
      
      console.log('HubSpot OAuth callback received:', { code: code.substring(0, 10) + '...', state })
      
      // Exchange code for tokens directly
      const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.HUBSPOT_CLIENT_ID!,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
          redirect_uri: `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/hubspot/callback`,
          code
        })
      })
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('HubSpot token exchange failed:', tokenResponse.status, errorText)
        throw new Error(`HubSpot token exchange failed: ${tokenResponse.status}`)
      }
      
      const tokens = await tokenResponse.json()
      console.log('HubSpot tokens received:', { expires_in: tokens.expires_in, token_type: tokens.token_type })
      
      // Get account info
      const accountResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token)
      if (!accountResponse.ok) {
        throw new Error('Failed to get HubSpot account info')
      }
      
      const accountInfo = await accountResponse.json()
      console.log('HubSpot account info:', { user: accountInfo.user, hub_id: accountInfo.hub_id })
      
      // Return a page that prompts for connection naming
      return new Response(
        `<html>
          <head>
            <title>Name Your HubSpot Connection</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; }
              .form-group { margin-bottom: 20px; }
              label { display: block; margin-bottom: 8px; font-weight: 500; }
              input, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; }
              button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; }
              button:hover { background: #0056b3; }
              .account-info { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>Name Your HubSpot Connection</h1>
            
            <div class="account-info">
              <strong>Connected Account:</strong> ${accountInfo.user}<br>
              <strong>Hub ID:</strong> ${accountInfo.hub_id}
            </div>
            
            <form id="namingForm">
              <div class="form-group">
                <label for="displayName">Connection Name *</label>
                <input 
                  type="text" 
                  id="displayName" 
                  placeholder="e.g., Sales CRM, Marketing CRM, Main HubSpot"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="description">Description (optional)</label>
                <textarea 
                  id="description" 
                  placeholder="e.g., Primary sales pipeline, Lead nurturing system"
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
                  // Store the connection with user-provided name
                  const response = await fetch('/api/tools/hubspot/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organizationId: '${state}',
                      displayName: displayName.trim(),
                      description: description.trim(),
                      tokens: ${JSON.stringify(tokens)},
                      accountInfo: ${JSON.stringify(accountInfo)}
                    })
                  });
                  
                  if (response.ok) {
                    window.opener?.postMessage({ type: 'hubspot_oauth_success' }, '*');
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
      console.error('HubSpot OAuth callback error:', error)
      
      return new Response(
        `<html>
          <body>
            <h1>HubSpot Connection Failed</h1>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <script>
              // Close the popup window
              window.opener?.postMessage({ 
                type: 'hubspot_oauth_error', 
                error: '${error instanceof Error ? error.message : 'Unknown error'}' 
              }, '*');
              window.close();
            </script>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      )
    }
  }
})