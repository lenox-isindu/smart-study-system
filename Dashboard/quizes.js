// quiz.js
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
    }
});

let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
    await initializeQuiz();
    setupEventListeners();
    const quizId = localStorage.getItem('selectedQuizId');
    
    // Get the attempts button
    const attemptsBtn = document.getElementById('attempts');
    
    // Set the href with the quiz ID parameter
    if (quizId) {
        attemptsBtn.addEventListener('click', function() {
            window.location.href = `attempts.html?quizId=${quizId}`;
        });
    } else {
        // Fallback if no quiz ID is found (link to general attempts page)
        attemptsBtn.addEventListener('click', function() {
            window.location.href = 'attempts.html';
        });
    }
});


let quizStartTime;
let currentAttemptId = null;

async function initializeQuiz() {
    quizStartTime = new Date();
    const quizId = localStorage.getItem('selectedQuizId');
    if (!quizId) return window.location.href = 'dashboard.html';

    try {
        const { data, error } = await supabase
            .from('generated_content')
            .select('content')
            .eq('id', quizId)
            .single();

        if (error) throw error;
        
        currentQuiz = data.content;
        userAnswers = new Array(currentQuiz.questions.length).fill(null);
        showQuestion(currentQuestionIndex);
    } catch (error) {
        console.error('Error loading quiz:', error);
        window.location.href = 'dashboard.html';
    }
}

async function showResults() {
    const score = calculateScore();
    const duration = Math.floor((new Date() - quizStartTime) / 1000);
    
    document.getElementById('quiz-container').classList.add('show-results');
    document.getElementById('score').textContent = `${score.correct}/${score.total}`;
    document.getElementById('percentage').textContent = `${score.percentage}%`;
    
    // Store attempt in Supabase
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const quizId = localStorage.getItem('selectedQuizId');
        
        const attemptData = {
            user_id: user.id,
            quiz_id: quizId,
            score: score.percentage,
            total_questions: score.total,
            correct_answers: score.correct,
            duration_seconds: duration,
            answers: currentQuiz.questions.map((q, i) => ({
                question_id: i,
                question: q.question,
                user_answer: userAnswers[i],
                correct_answer: q.answer,
                explanation: q.explanation,
                is_correct: userAnswers[i] === q.answer
            }))
        };

        const { data, error } = await supabase
            .from('quiz_attempts')
            .insert([attemptData])
            .select()
            .single();

        if (error) throw error;
        currentAttemptId = data.id;
    } catch (error) {
        console.error('Error saving attempt:', error);
        alert('Could not save your results. Please try again.');
    }

    // Add attempt number
    const { count } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact' })
        .eq('quiz_id', localStorage.getItem('selectedQuizId'))
        .eq('user_id', user.id);

    document.getElementById('percentage').innerHTML = `
        ${score.percentage}% 
        <span class="attempt-number">(Attempt ${count})</span>
    `;
}


document.getElementById('review-btn').addEventListener('click', showReview);
document.getElementById('nav-btn').addEventListener('click', closeReview)

function showReview() {
    const modal = document.getElementById('review-modal');
    const container = document.getElementById('review-questions');
    container.innerHTML = '';

    currentQuiz.questions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.answer;
        
        const questionEl = document.createElement('div');
        questionEl.className = `review-question ${isCorrect ? 'correct' : 'incorrect'}`;
        questionEl.innerHTML = `
            <div class="review-question-header">
                <h4>Question ${index + 1}</h4>
                <span class="status">${isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
            </div>
            <p class="question-text">${question.question}</p>
            <div class="review-answers">
                <div class="user-answer">
                    <strong>Your answer:</strong> ${userAnswer || 'No answer'}
                </div>
                <div class="correct-answer">
                    <strong>Correct answer:</strong> ${question.answer}
                </div>
                ${question.explanation ? `
                <div class="explanation">
                    <strong>Explanation:</strong> ${question.explanation}
                </div>` : ''}
            </div>
        `;
        container.appendChild(questionEl);
    });

    modal.style.display = 'block';
}


function closeReview() {
    document.getElementById('review-modal').style.display = 'none';
}

function setupEventListeners() {
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion(currentQuestionIndex);
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentQuestionIndex < currentQuiz.questions.length - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
        } else {
            showResults();
        }
    });

    document.getElementById('submit-btn').addEventListener('click', showResults);
    document.getElementById('retry-btn').addEventListener('click', handleRetry);


    function resetQuizState() {
        currentQuestionIndex = 0;
        userAnswers = new Array(currentQuiz.questions.length).fill(null);
        quizStartTime = new Date();
        
        // Reset UI state
        document.getElementById('quiz-container').classList.remove('show-results');
        document.querySelectorAll('.option.selected').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Reset progress bar
        const progressBar = document.querySelector('.progress');
        progressBar.style.width = '0%';
        
        showQuestion(0);
    }
    
    async function handleRetry() {
        // Confirm with user
        if (!confirm('Start new attempt? Previous answers will be cleared.')) return;
        
        try {
            // Reset state
            resetQuizState();
            
            // Log retry in database
            const { data: { user } } = await supabase.auth.getUser();
            await supabase
                .from('quiz_attempts')
                .update({ is_retry: true })
                .eq('id', currentAttemptId)
                .eq('user_id', user.id);
                
        } catch (error) {
            console.error('Retry error:', error);
        }
    }
}



function showQuestion(index) {
    const question = currentQuiz.questions[index];
    const optionsContainer = document.getElementById('options-container');
    
    // Update question text
    document.getElementById('question-text').textContent = question.question;
    
    // Clear previous options
    optionsContainer.innerHTML = '';
    
    // Add new options
    Object.entries(question.options).forEach(([key, value]) => {
        const option = document.createElement('div');
        option.className = `option ${userAnswers[index] === key ? 'selected' : ''}`;
        option.innerHTML = `
            <span class="option-key">${key}</span>
            <span class="option-text">${value}</span>
        `;
        option.addEventListener('click', () => selectAnswer(key, index));
        optionsContainer.appendChild(option);
    });
    
    // Update navigation states
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').style.display = 
        index === currentQuiz.questions.length - 1 ? 'none' : 'block';
    document.getElementById('submit-btn').style.display = 
        index === currentQuiz.questions.length - 1 ? 'block' : 'none';
    
    // Update question counter
    document.getElementById('question-counter').textContent = 
        `Question ${index + 1} of ${currentQuiz.questions.length}`;

    const progress = (index / currentQuiz.questions.length) * 100;
    document.querySelector('.progress').style.width = `${progress}%`;
    
}

function selectAnswer(answer, index) {
    userAnswers[index] = answer;
    showQuestion(index); // Refresh the display
}



function calculateScore() {
    const total = currentQuiz.questions.length;
    const correct = currentQuiz.questions.reduce((acc, q, i) => 
        acc + (userAnswers[i] === q.answer ? 1 : 0), 0);
    
    return {
        total,
        correct,
        percentage: Math.round((correct / total) * 100)
    };
}