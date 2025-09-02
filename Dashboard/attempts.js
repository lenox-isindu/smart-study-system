const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
// Wait for Supabase to be ready
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                flowType: 'pkce',
                detectSessionInUrl: true,
                persistSession: true,
                autoRefreshToken: true
            }
        });
    }

// DOM Elements
const attemptsList = document.getElementById('attempts-list');
const quizTitle = document.getElementById('quiz-title');
const backButton = document.getElementById('back-button');

// Initialize when DOM loads

    const quizId = getQuizIdFromURL();
    if (!quizId) {
        showError("No quiz ID provided");
        return;
    }
    
    await loadQuizInfo(quizId);
    await loadQuizAttempts(quizId);


// Get quiz ID from URL parameters
function getQuizIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('quizId');
}

// Load basic quiz information
async function loadQuizInfo(quizId) {
    try {
        const { data, error } = await supabase
            .from('generated_content')
            .select('*')
            .eq('id', quizId)
            .single();

        if (error) throw error;
        
        if (quizTitle) {
            quizTitle.textContent = data.title || 'Quiz Attempts';
        }
    } catch (error) {
        console.error('Error loading quiz info:', error);
        if (quizTitle) quizTitle.textContent = 'Quiz Attempts';
    }
}

// Load attempts for a specific quiz
async function loadQuizAttempts(quizId) {
    try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) {
            showError("Please login to view attempts");
            return;
        }

        // Fetch attempts for this quiz and user
        const { data: attempts, error } = await supabase
            .from('quiz_attempts')
            .select(`
                id,
                score,
                total_questions,
                correct_answers,
                duration_seconds,
                attempted_at,
                is_retry,
                previous_attempt_id
            `)
            .eq('quiz_id', quizId)
            .eq('user_id', user.id)
            .order('attempted_at', { ascending: false });

        if (error) throw error;

        calculateAndDisplayStats(attempts);
        displayAttempts(attempts);
        console.log(attempts)
    } catch (error) {
        console.error("Error loading attempts:", error);
        showError("Failed to load attempts. Please try again.");
    } finally {
        setLoading(false);
    }
}

function calculateAndDisplayStats(attempts) {
    if (!attempts || attempts.length === 0) {
        // Set default values if no attempts
        document.getElementById('total-time').textContent = '0m 0s';
        document.getElementById('best-score').textContent = '0%';
        document.getElementById('attempt-count').textContent = '0';
        return;
    }

    // Calculate total time
    const totalSeconds = attempts.reduce((sum, attempt) => sum + attempt.duration_seconds, 0);
    document.getElementById('total-time').textContent = formatTime(totalSeconds);

    // Calculate best score
    const bestScore = Math.max(...attempts.map(attempt => attempt.score));
    document.getElementById('best-score').textContent = `${bestScore}%`;

    // Count attempts
    document.getElementById('attempt-count').textContent = attempts.length;
}

// Helper function to format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}
// Display attempts in the UI
function displayAttempts(attempts) {
    if (attempts.length === 0) {
        attemptsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No Attempts Found</h3>
                <p>You haven't attempted this quiz yet.</p>
            </div>
        `;
        return;
    }

    attemptsList.innerHTML = attempts.map((attempt, index) => {
        const scoreClass = attempt.score >= 70 ? 'high-score' : 'low-score';
        const isRetry = attempt.is_retry ? '<span class="retry-badge">Retry</span>' : '';
        const date = new Date(attempt.attempted_at).toLocaleString();

        return `
            <div class="attempt-card ${scoreClass}">
                <div class="attempt-header">
                    <h3>Attempt #${index + 1} ${isRetry}</h3>
                    <span class="attempt-date">${date}</span>
                </div>
                <div class="attempt-details">
                    <div class="detail-item">
                        <span class="detail-label">Score</span>
                        <span class="detail-value">${attempt.score}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Time Spent</span>
                        <span class="detail-value">${formatTime(attempt.duration_seconds)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Correct Answers</span>
                        <span class="detail-value">${attempt.correct_answers}/${attempt.total_questions}</span>
                    </div>
                </div>
                <a href="view_attempt.html?attemptId=${attempt.id}" class="view-btn">
                    <i class="fas fa-eye"></i> View Details
                </a>
            </div>
        `;
    }).join('');
}

// Format time from seconds to MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

// Error handling
function showError(message) {
    attemptsList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Attempts</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()" class="view-btn">
                <i class="fas fa-sync-alt"></i> Try Again
            </button>
        </div>
    `;
}


if (backButton) {
    backButton.addEventListener('click', () => {
        window.history.back();
    });
}
})