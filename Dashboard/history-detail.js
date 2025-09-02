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

let currentUser = null;

async function initializeAuth() {
    // Add OAuth callback handling first
    if (window.location.hash.includes('access_token')) {
        const { data, error } = await supabase.auth.getSessionFromUrl();
        if (error) {
            console.error('Session error:', error);
            redirectToDashboard();
            return;
        }
    }

    // Then check for user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = '/Dashboard/index.html';
        return;
    }

    currentUser = user;
    initializeDetailPage();
}

async function initializeDetailPage() {
    // Changed to use filename instead of subject
    const fileName = decodeURIComponent(localStorage.getItem('selectedFileName'));
    
    if (!fileName) {
        showError('No file selected');
        return;
    }

    try {
        // Fetch content for this filename
        const { data, error } = await supabase
            .from('generated_content')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('file_name', fileName)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data.length) throw new Error('No content found');
        
        renderContent(fileName, data);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}


function setupToggleButtons() {
    document.querySelectorAll('.toggle-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and sections
            document.querySelectorAll('.toggle-btn, .content-section').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to clicked button and target section
            const target = button.dataset.target;
            button.classList.add('active');
            document.getElementById(`${target}-list`).classList.add('active');
        });
    });
}


function renderContent(fileName, items) {
    document.getElementById('loading').style.display = 'none';
    const container = document.getElementById('content-detail');
    
    document.getElementById('detail-title').textContent = fileName;
    document.getElementById('detail-count').textContent = 
        `${items.length} items for this file`;

    // Separate items by type
    const summaries = items.filter(item => item.content_type === 'summary');
    const quizzes = items.filter(item => item.content_type === 'quiz');
    setupDateGroups(quizzes);

    renderSummaries(summaries);
    renderQuizzes(quizzes);
    
    container.style.display = 'block';
    setupToggleButtons(); // Initialize the toggle buttons
    setupDateGroups();
}

function renderSummaries(summaries) {
    const container = document.getElementById('summaries-list');
    container.innerHTML = summaries.map(item => `
        <div class="summary-item">
            <div class="item-header">
                <span class="item-date">
                    ${new Date(item.created_at).toLocaleDateString()}
                </span>
                <span class="summary-subject">
                    ${item.content?.subject || 'No subject'}
                </span>
            </div>
            <div class="summary-content">
                ${item.content?.summary || 'No summary available'}
            </div>
        </div>
    `).join('');
}

function renderQuizzes(quizzes) {
    const container = document.getElementById('quizzes-list');
    const groupedQuizzes = groupQuizzesByDate(quizzes);
    
    // Fixed: Added proper HTML string joining
    container.innerHTML = Object.entries(groupedQuizzes).map(([dateString, quizzes]) => `
        <div class="quiz-date-group">
            <div class="date-header">
                <span class="date-title">${formatDateString(dateString)}</span>
                <span class="quiz-count">${quizzes.length} quiz${quizzes.length > 1 ? 'zes' : ''}</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </div>
            <div class="date-quizzes">
                ${quizzes.map(quiz => `
                    <div class="quiz-card" data-id="${quiz.id}">
                        <div class="quiz-meta">
                            <span class="quiz-subject">
                                ${quiz.content?.subject || 'General'}
                            </span>
                            <span class="quiz-time">
                                ${new Date(quiz.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                        <div class="quiz-preview">
                            ${quiz.content?.questions?.length || 0} questions
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}
function groupQuizzesByDate(quizzes) {
    return quizzes.reduce((acc, quiz) => {
        const dateKey = new Date(quiz.created_at).toISOString().split('T')[0];
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(quiz);
        return acc;
    }, {});
}

function formatDateString(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function renderDateQuizzes(quizzes) {
    return quizzes.map(quiz => `
        <div class="quiz-card" data-id="${quiz.id}">
            <div class="quiz-meta">
                <span class="quiz-type">${quiz.content_type}</span>
                <span class="quiz-time">
                    ${new Date(quiz.created_at).toLocaleTimeString()}
                </span>
            </div>
            <div class="quiz-preview">
                ${quiz.content?.questions?.length || 0} questions
            </div>
        </div>
    `).join('');
}

function setupDateGroups(quizzes) {
    document.querySelectorAll('.date-header').forEach(header => {
        header.addEventListener('click', () => {
            const group = header.closest('.quiz-date-group');
            const quizzes = group.querySelector('.date-quizzes');
            const icon = group.querySelector('.toggle-icon');
            
            group.classList.toggle('active');
            quizzes.style.display = group.classList.contains('active') ? 'block' : 'none';
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });
    });
    
    // Update quiz card click handlers
    document.querySelectorAll('.quiz-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const quizId = card.dataset.id;
            
            // Store quiz ID in localStorage
            localStorage.setItem('selectedQuizId', quizId);
            
            // Redirect to quiz page
            window.location.href = 'quizes.html';
        });
    });
}

function showItemDetail(item) {
    // Reuse your existing modal logic or create a new one
    const modal = document.getElementById('content-modal');
    // ... rest of your existing showFullContent logic ...
}
function showError(message = 'Failed to load content') {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
}

// Back button functionality
document.getElementById('back-btn').addEventListener('click', () => {
    window.history.back();
});

document.addEventListener('DOMContentLoaded', initializeAuth);