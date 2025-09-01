document.addEventListener('DOMContentLoaded', async () => {

    if (!window.supabase) {
        console.error('Supabase client not initialized');
        showError('Failed to initialize application');
        return;
    }
    // Get attempt ID from URL
    const params = new URLSearchParams(window.location.search);
    const attemptId = params.get('attemptId');
    
    if (!attemptId) {
        showError('No attempt ID provided');
        return;
    }

    // Load attempt data
    try {

        // Show loading state
        document.getElementById('quiz-attempt').innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading attempt details...</p>
            </div>
        `;
        
        const { data: attempt, error } = await supabase
            .from('quiz_attempts')
            .select(`
                *,
                quiz:quiz_id
            `)
            .eq('id', attemptId)
            .single();

        if (error) throw error;
        if (!attempt) throw new Error('Attempt not found');

        displayAttemptDetails(attempt);
        renderQuestions(attempt);
    } catch (error) {
        console.error('Error loading attempt:', error);
        showError(error.message);
    }

    // Setup navigation
    document.getElementById('back-to-attempts').addEventListener('click', () => {
        window.history.back();
    });

    document.getElementById('summary-link').addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSummary();
    });
});

function displayAttemptDetails(attempt) {
    // Set attempt metadata
    const attemptDate = new Date(attempt.attempted_at);
    document.getElementById('attempt-date').textContent = attemptDate.toLocaleDateString();
    document.getElementById('attempt-time').textContent = attemptDate.toLocaleTimeString();
    document.getElementById('attempt-duration').textContent = formatTime(attempt.duration_seconds);

    // Set performance stats
    document.getElementById('score-percentage').textContent = `${attempt.score}%`;
    document.getElementById('correct-count').textContent = attempt.correct_answers;
    document.getElementById('incorrect-count').textContent = attempt.total_questions - attempt.correct_answers;
    document.getElementById('total-questions').textContent = attempt.total_questions;
}

function renderQuestions(attempt) {
    const container = document.getElementById('quiz-attempt');
    container.innerHTML = '';

    if (!attempt.answers || !Array.isArray(attempt.answers)) {
        container.innerHTML = '<div class="error-state">No question data available</div>';
        return;
    }

    attempt.answers.forEach((question, index) => {
        const isCorrect = question.user_answer === question.correct_answer;
        const questionEl = document.createElement('div');
        questionEl.className = `question-card ${isCorrect ? 'correct' : 'incorrect'}`;
        questionEl.innerHTML = `
            <div class="question-header">
                <h3>Question ${index + 1}</h3>
                <span class="status-badge ${isCorrect ? 'correct' : 'incorrect'}">
                    ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
            </div>
            <div class="question-text">${question.question}</div>
            <div class="answers-container">
                <div class="user-answer">
                    <label>Your Answer:</label>
                    <div class="answer ${isCorrect ? 'correct' : 'incorrect'}">
                        ${question.user_answer || 'No answer provided'}
                    </div>
                </div>
                ${!isCorrect ? `
                <div class="correct-answer">
                    <label>Correct Answer:</label>
                    <div class="answer correct">
                        ${question.correct_answer}
                    </div>
                </div>` : ''}
                ${question.explanation ? `
                <div class="explanation">
                    <label>Explanation:</label>
                    <p>${question.explanation}</p>
                </div>` : ''}
            </div>
        `;
        container.appendChild(questionEl);
    });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function scrollToSummary() {
    document.querySelector('.performance-summary').scrollIntoView({
        behavior: 'smooth'
    });
}

function showError(message) {
    const container = document.getElementById('quiz-attempt');
    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Attempt</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()" class="retry-btn">
                <i class="fas fa-sync-alt"></i> Try Again
            </button>
        </div>
    `;
}