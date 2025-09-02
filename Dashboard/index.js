const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true
        }
    }
);

// Handle Google login button
document.getElementById('google-login').addEventListener('click', handleGoogleLogin);

// Auth state listener
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        await checkAuthStatus();
    }
});

async function handleGoogleLogin() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/Dashboard/dashboard.html'
        }
      });
      
      if (error) throw error;
  
    } catch (error) {
      console.error('Login error:', error);
    }
  }

// Check authentication status
async function checkAuthStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        // Get base path from current URL
        const basePath = window.location.href.split('/').slice(0, -1).join('/');
        
        // Construct correct dashboard path
        const dashboardPath = `${basePath}/dashboard.html`;
        
        console.log('Redirecting to:', dashboardPath); // Debug log
        
        window.location.href = dashboardPath;
    }
}

// Initial check when page loads
(async () => {
    // Handle OAuth callback if we're returning from redirect
    if (window.location.hash.includes('access_token')) {
        const { data, error } = await supabase.auth.getSessionFromUrl();
        if (error) throw error;
    }
    
    await checkAuthStatus();
})();