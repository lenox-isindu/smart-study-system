
// Configuration - Replace with your Supabase credentials
const SUPABASE_URL = "https://omcrqzojzbbsyznpriyf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3Jxem9qemJic3l6bnByaXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyODYxNzYsImV4cCI6MjA1Njg2MjE3Nn0.L7IQ0AZ1hg4SxZIwcz6lFw7qQbDlW-FkWlAKV0ZTi2I";

// Initialize Supabase
const supabase = window.supabase.createClient(
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

// State Management
let currentUser = null;
let currentView = 'grid';
let currentFilter = 'today';
let allDocuments = [];
let seenFileNames = new Set();
let userQuota = null;
let userSubscription = null;

// DOM Elements
const elements = {
    sidebar: document.querySelector('.sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    searchInput: document.getElementById('search'),
    searchSuggestions: document.getElementById('search-suggestions'),
    documentsContainer: document.getElementById('documents-container'),
    logoutButton: document.getElementById('logout'),
    userProfilePic: document.getElementById('user-profile-pic'),
    username: document.getElementById('username'),
    userEmail: document.getElementById('user-email'),
    modal: document.getElementById('content-modal'),
    newDocumentModal: document.getElementById('new-document-modal'),
    newDocumentBtn: document.getElementById('new-document-btn'),
    newDocumentForm: document.getElementById('new-document-form'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    documentDate: document.getElementById('document-date'),
    documentType: document.getElementById('document-type'),
    viewButtons: document.querySelectorAll('.view-btn'),
    timeFilters: document.querySelectorAll('.time-filter'),
    themeToggle: document.getElementById('theme-toggle'),
    timeGreeting: document.getElementById('time-greeting'),
    usernameDisplay: document.getElementById('username-display'),
    userStatus: document.getElementById('user-status'),
    upgradeButton: document.getElementById('upgrade-button'),
    premiumFlashcard: document.getElementById('premium-flashcard')
};

// Update welcome message based on time of day
function updateTimeGreeting() {
    const hour = new Date().getHours();
    
    if (hour < 12) {
        elements.timeGreeting.textContent = 'Good Morning,';
    } else if (hour < 18) {
        elements.timeGreeting.textContent = 'Good Afternoon,';
    } else {
        elements.timeGreeting.textContent = 'Good Evening,';
    }
}

// Display username
function displayUsername() {
    if (currentUser) {
        const username = currentUser.user_metadata?.full_name || 
                        currentUser.email?.split('@')[0] || 
                        'Learner';
        elements.usernameDisplay.textContent = username;
    }
}

// Auth Initialization
async function initializeAuth() {
    // Handle OAuth callback from URL
    if (window.location.hash.includes('access_token')) {
        const { data, error } = await supabase.auth.getSessionFromUrl();
        if (error) console.error('Session error:', error);
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = '/Dashboard/index.html';
        return;
    }

    // Update user profile in sidebar
    if (user.user_metadata?.avatar_url) {
        elements.userProfilePic.src = user.user_metadata.avatar_url;
        elements.userProfilePic.style.display = 'block';
        document.querySelector('.fallback-icon').style.display = 'none';
    }

    elements.username.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
    elements.userEmail.textContent = user.email;

    currentUser = user;
    initializeDashboard();
    setupEventListeners();
    
    console.log('Authenticated user:', user);
    await fetchGeneratedContent();
}

// Fetch user's generated content
async function fetchGeneratedContent() {
    try {
        const { data, error } = await supabase
            .from('generated_content')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1000); 

        if (error) throw error;
        
        // Filter out duplicates by file_name
        seenFileNames.clear();
        allDocuments = data.filter(item => {
            if (!seenFileNames.has(item.file_name)) {
                seenFileNames.add(item.file_name);
                return true;
            }
            return false;
        });
        
        filterAndRenderDocuments();
        
    } catch (error) {
        console.error('Fetch error:', error);
        showError('Failed to load documents. Please try again.');
    }
}

function filterAndRenderDocuments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filteredDocuments = allDocuments.filter(item => {
        const itemDate = new Date(item.created_at);
        
        switch(currentFilter) {
            case 'today':
                return itemDate >= today;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return itemDate >= weekAgo;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return itemDate >= monthAgo;
            default:
                return true; // 'all' filter
        }
    });
    
    renderAllDocuments(filteredDocuments);
}

function renderAllDocuments(documents) {
    elements.documentsContainer.innerHTML = '';
    
    if (documents.length === 0) {
        elements.documentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No documents found</h3>
                <p>${getEmptyStateMessage()}</p>
            </div>
        `;
        return;
    }
    
    documents.forEach(item => {
        const card = createDocumentCard(item);
        elements.documentsContainer.appendChild(card);
    });
}

function getEmptyStateMessage() {
    switch(currentFilter) {
        case 'today':
            return "You haven't created any documents today";
        case 'week':
            return "You haven't created any documents this week";
        case 'month':
            return "You haven't created any documents this month";
        default:
            return "Create your first document to get started";
    }
}

function createDocumentCard(item) {
    const card = document.createElement('div');
    card.className = 'document-card';
    card.dataset.fileName = item.file_name;
    card.dataset.id = item.id;
    card.dataset.createdAt = item.created_at;
    
    const icon = getDocumentIcon(item.content_type);
    const previewText = item.content?.summary?.substring(0, 100) || 
                       item.content?.questions?.[0]?.question?.substring(0, 100) || 
                       'No preview available';
    
    card.innerHTML = `
        <div class="document-image">
            ${icon}
        </div>
        <div class="document-content">
            <h3 class="document-title">${item.file_name || 'Untitled Document'}</h3>
            <p class="document-preview">${previewText}</p>
            <div class="document-footer">
                <small>${formatDate(item.created_at)}</small>
                <div class="document-actions">
                    <button class="document-action" data-action="preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="document-action" data-action="download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.document-action')) {
            openDocumentDetail(item);
        }
    });
    
    // Add action button event listeners
    card.querySelector('[data-action="preview"]').addEventListener('click', (e) => {
        e.stopPropagation();
        showDocumentPreview(item);
    });
    
    card.querySelector('[data-action="download"]').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocument(item);
    });
    
    return card;
}

function getDocumentIcon(contentType) {
    const icons = {
        'quiz': '<i class="fas fa-question-circle"></i>',
        'summary': '<i class="fas fa-file-alt"></i>',
        'flashcards': '<i class="fas fa-layer-group"></i>',
        'notes': '<i class="fas fa-sticky-note"></i>'
    };
    
    return icons[contentType] || '<i class="fas fa-file"></i>';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showDocumentPreview(item) {
    elements.modalTitle.textContent = item.file_name || 'Document Preview';
    elements.documentDate.textContent = formatDate(item.created_at) + ' at ' + new Date(item.created_at).toLocaleTimeString();
    elements.documentType.textContent = item.content_type || 'Document';
    
    // Format the content for display
    let contentHTML = '';
    
    if (item.content_type === 'quiz') {
        contentHTML = `
            <div class="quiz-preview">
                <h4>Quiz Questions</h4>
                <ol>
                    ${item.content.questions.map(q => 
                        `<li>
                            <strong>${q.question}</strong><br>
                            <small>Answer: ${q.answer}</small>
                        </li>`
                    ).join('')}
                </ol>
            </div>
        `;
    } else if (item.content_type === 'summary') {
        contentHTML = `
            <div class="summary-preview">
                <h4>Summary</h4>
                <p>${item.content.summary}</p>
                ${item.content.key_points ? `
                    <h5>Key Points</h5>
                    <ul>
                        ${item.content.key_points.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    } else if (item.content_type === 'flashcards') {
        contentHTML = `
            <div class="flashcards-preview">
                <h4>Flashcards</h4>
                <div class="flashcards-grid">
                    ${item.content.cards.map(card => `
                        <div class="flashcard">
                            <div class="flashcard-front">
                                <strong>Front:</strong> ${card.front}
                            </div>
                            <div class="flashcard-back">
                                <strong>Back:</strong> ${card.back}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        contentHTML = `
            <div class="content-preview">
                <pre>${JSON.stringify(item.content, null, 2)}</pre>
            </div>
        `;
    }
    
    elements.modalBody.innerHTML = contentHTML;
    elements.modal.style.display = 'flex';
    
    // Set up the "Open Full Document" button
    const openBtn = document.querySelector('.open-full-btn');
    openBtn.onclick = () => {
        openDocumentDetail(item);
    };
}

function openDocumentDetail(item) {
    localStorage.setItem('selectedFileName', encodeURIComponent(item.file_name));
    window.location.pathname = '/Dashboard/history-detail.html';
}

function downloadDocument(item) {
    let content = '';
    if (item.content_type === 'quiz') {
        content = `Quiz: ${item.file_name}\n\n`;
        content += item.content.questions.map((q, i) => 
            `${i+1}. ${q.question}\nAnswer: ${q.answer}`
        ).join('\n\n');
    } else if (item.content_type === 'summary') {
        content = `Summary: ${item.file_name}\n\n`;
        content += item.content.summary + '\n\n';
        if (item.content.key_points) {
            content += 'Key Points:\n';
            content += item.content.key_points.map(point => `• ${point}`).join('\n');
        }
    } else {
        content = JSON.stringify(item.content, null, 2);
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.file_name || 'document'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Fetch user quota information
async function fetchUserQuota() {
    try {
        const { data, error } = await supabase
            .from('user_quotas')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                // Create initial quota record
                const { data: newQuota, error: insertError } = await supabase
                    .from('user_quotas')
                    .insert([{ 
                        user_id: currentUser.id,
                        quiz_generation_limit: 5,
                        summary_generation_limit: 5,
                        quiz_generation_count: 0,
                        summary_generation_count: 0
                    }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                userQuota = newQuota;
            } else {
                throw error;
            }
        } else {
            userQuota = data;
        }
        
        // Update UI with quota information
        updateQuotaUI();
        
    } catch (error) {
        console.error('Error fetching user quota:', error);
    }
}

// Update quota UI display for sidebar
function updateQuotaUI() {
    if (!userQuota) return;
    
    const quizzesLeft = Math.max(0, userQuota.quiz_generation_limit - userQuota.quiz_generation_count);
    const summariesLeft = Math.max(0, userQuota.summary_generation_limit - userQuota.summary_generation_count);
    
    // Update sidebar display
    document.getElementById('sidebar-quiz-count').textContent = userQuota.quiz_generation_count;
    document.getElementById('sidebar-summary-count').textContent = userQuota.summary_generation_count;
    
    // Calculate and update progress
    const totalUsed = userQuota.quiz_generation_count + userQuota.summary_generation_count;
    const totalLimit = userQuota.quiz_generation_limit + userQuota.summary_generation_limit;
    const percentage = Math.min(100, Math.round((totalUsed / totalLimit) * 100));
    
    document.getElementById('quota-progress').style.width = `${percentage}%`;
    document.getElementById('quota-percentage').textContent = `${percentage}% Used`;
    
    // Change color based on usage
    const progressFill = document.getElementById('quota-progress');
    if (percentage < 70) {
        progressFill.style.background = 'linear-gradient(90deg, #4cc9f0, #4361ee)';
    } else if (percentage < 90) {
        progressFill.style.background = 'linear-gradient(90deg, #f8961e, #f72585)';
    } else {
        progressFill.style.background = 'linear-gradient(90deg, #ff4d6d, #f72585)';
    }
    
    // For premium users, update the sidebar style
    const quotaSidebar = document.getElementById('quota-sidebar');
    if (userSubscription) {
        quotaSidebar.classList.add('premium');
        quotaSidebar.innerHTML = `
            <div class="quota-header">
                <i class="fas fa-crown"></i>
                <span>Premium Account</span>
            </div>
            <div style="text-align: center; padding: 10px 0;">
                <i class="fas fa-infinity" style="font-size: 32px; color: #4cc9f0; margin-bottom: 10px;"></i>
                <p style="color: rgba(255,255,255,0.9); margin: 0;">Unlimited access to all features</p>
            </div>
        `;
    } else {
        quotaSidebar.classList.remove('premium');
    }
}

// Fetch user subscription status
async function fetchUserSubscription() {
    try {
        // Check localStorage first for subscription status
        const localSubscription = localStorage.getItem('userSubscription');
        if (localSubscription === 'active') {
            userSubscription = {
                status: 'active',
                current_period_end: localStorage.getItem('subscriptionEndDate')
            };
            return;
        }
        
        // Get all subscriptions for user and filter client-side
        const { data: subscriptions, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return;
        }

        // Find active or trialing subscription
        userSubscription = subscriptions.find(sub => 
            sub.status === 'active' || sub.status === 'trialing'
        );

    } catch (error) {
        console.error('Error fetching subscription:', error);
    }
}

// Update UI based on user status
function updateUIWithUserStatus() {
    if (!elements.userStatus) return;
    
    elements.userStatus.style.display = 'block';
    
    if (userSubscription) {
        elements.userStatus.innerHTML = `
            <div style="background: #e8f5e8; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <span style="color: #27ae60;">
                    <i class="fas fa-crown"></i> Premium Member
                </span>
                <br>
                <small>Subscription active until: ${new Date(userSubscription.current_period_end).toLocaleDateString()}</small>
            </div>
        `;
        
        if (elements.upgradeButton) {
            elements.upgradeButton.textContent = 'Manage Subscription';
            elements.upgradeButton.onclick = manageSubscription;
        }
    } else {
        const quizzesLeft = userQuota ? Math.max(0, userQuota.quiz_generation_limit - userQuota.quiz_generation_count) : 0;
        const summariesLeft = userQuota ? Math.max(0, userQuota.summary_generation_limit - userQuota.summary_generation_count) : 0;
        
        elements.userStatus.innerHTML = `
            <div style="background: #fff3e0; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <span style="color: #e67e22;">
                    <i class="fas fa-user"></i> Free Account
                </span>
                <br>
                <small>Quizzes left: ${quizzesLeft} | Summaries left: ${summariesLeft}</small>
            </div>
        `;
        
        if (elements.upgradeButton) {
            elements.upgradeButton.textContent = 'Upgrade Now - $8/month';
            elements.upgradeButton.onclick = function() {
                window.location.href = 'checkout.html';
            };
        }
    }
    
    // Update the sidebar quota display
    updateQuotaUI();
}

// Check if user needs to upgrade
function checkIfNeedsUpgrade() {
    if (userSubscription) {
        // User has active subscription, no need to show upgrade prompt
        return;
    }

    if (userQuota && 
        (userQuota.quiz_generation_count >= userQuota.quiz_generation_limit ||
         userQuota.summary_generation_count >= userQuota.summary_generation_limit)) {
        showPremiumFlashcard();
    }
}

// Show premium upgrade flashcard
function showPremiumFlashcard() {
    if (!elements.premiumFlashcard) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'flashcard-overlay';
    document.body.appendChild(overlay);
    elements.premiumFlashcard.style.display = 'block';
}

// Hide premium upgrade flashcard
function hidePremiumFlashcard() {
    const overlay = document.querySelector('.flashcard-overlay');
    if (overlay) overlay.remove();
    if (elements.premiumFlashcard) elements.premiumFlashcard.style.display = 'none';
}

// Manage subscription (for future implementation)
function manageSubscription() {
    alert('Subscription management portal coming soon!');
}

// Update quota when user generates content - FIXED VERSION
async function incrementQuotaCount(contentType) {
    if (userSubscription) {
        // Premium users don't have quotas
        return { canProceed: true };
    }

    try {
        const countField = `${contentType}_generation_count`;
        const limitField = `${contentType}_generation_limit`;
        
        // Check if user has reached their limit
        if (userQuota && userQuota[countField] >= userQuota[limitField]) {
            return { 
                canProceed: false, 
                message: `You've reached your ${contentType} generation limit. Upgrade to premium for unlimited access.` 
            };
        }
        
        // First get the current count to ensure we're incrementing correctly
        const { data: currentData, error: fetchError } = await supabase
            .from('user_quotas')
            .select(countField)
            .eq('user_id', currentUser.id)
            .single();

        if (fetchError) throw fetchError;
        
        const newCount = (currentData[countField] || 0) + 1;
        
        const { data, error } = await supabase
            .from('user_quotas')
            .update({ 
                [countField]: newCount,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id)
            .select()
            .single();

        if (error) throw error;
        
        userQuota = data;
        updateQuotaUI();
        updateUIWithUserStatus();
        
        // Check if user reached limit after this operation
        checkIfNeedsUpgrade();
        
        return { canProceed: true };
        
    } catch (error) {
        console.error('Error updating quota:', error);
        return { canProceed: false, message: 'Error updating quota' };
    }
}

function setupEventListeners() {
    // Sidebar toggle for mobile
    elements.sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992 && 
            !e.target.closest('.sidebar') && 
            !e.target.closest('.sidebar-toggle')) {
            elements.sidebar.classList.remove('active');
        }
    });
    
    // Logout button
    elements.logoutButton.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;
            
            // Clear local session data
            localStorage.removeItem(`sb-${SUPABASE_URL.split('/')[2]}-auth-token`);
            localStorage.removeItem('userSubscription');
            localStorage.removeItem('subscriptionEndDate');
            
            // Redirect to login page
            window.location.href = '/Dashboard/index.html';
        } catch (error) {
            console.error('Logout failed:', error);
            showError('Logout failed: ' + error.message);
        }
    });
    
    // Modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
    
    // View toggle buttons
    elements.viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            elements.documentsContainer.className = currentView === 'grid' ? 'documents-grid' : 'documents-list';
        });
    });
    
    // Time filter buttons
    elements.timeFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            elements.timeFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            currentFilter = filter.dataset.period;
            filterAndRenderDocuments();
        });
    });
    
    // Search functionality
    elements.searchInput.addEventListener('input', debounce(searchDocuments, 300));
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // New document button
    if (elements.newDocumentBtn) {
        elements.newDocumentBtn.addEventListener('click', () => {
            elements.newDocumentModal.style.display = 'flex';
        });
    }
    
    // New document form submission - FIXED QUOTA HANDLING
    if (elements.newDocumentForm) {
        elements.newDocumentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('document-title').value;
            const type = document.getElementById('document-type').value;
            const content = document.getElementById('document-content').value;
            
            if (!title || !content) {
                showError('Please fill in all fields');
                return;
            }
            
            try {
                // Check quota before creating document
                const quotaCheck = await incrementQuotaCount(type);
                if (!quotaCheck.canProceed) {
                    alert(quotaCheck.message);
                    return;
                }
                
                let documentContent = {};
                const now = new Date().toISOString();
                
                if (type === 'quiz') {
                    documentContent = {
                        questions: content.split('\n\n').map(q => {
                            const [question, answer] = q.split('\n');
                            return { question, answer: answer || 'No answer provided' };
                        })
                    };
                } else if (type === 'summary') {
                    documentContent = {
                        summary: content,
                        key_points: content.split('\n').filter(line => line.trim())
                    };
                } else {
                    documentContent = { text: content };
                }
                
                const { data, error } = await supabase
                    .from('generated_content')
                    .insert([{
                        user_id: currentUser.id,
                        file_name: title,
                        content_type: type,
                        content: documentContent,
                        created_at: now
                    }]);
                
                if (error) throw error;
                
                await fetchGeneratedContent();
                elements.newDocumentModal.style.display = 'none';
                elements.newDocumentForm.reset();
                
            } catch (error) {
                console.error('Error creating document:', error);
                showError('Failed to create document. Please try again.');
            }
        });
    }
    
    // Premium flashcard close button
    const closeFlashcard = document.querySelector('.close-flashcard');
    if (closeFlashcard) {
        closeFlashcard.addEventListener('click', hidePremiumFlashcard);
    }
    
    // Upgrade button
    if (elements.upgradeButton) {
        elements.upgradeButton.addEventListener('click', function() {
            window.location.href = 'checkout.html';
        });
    }
    
    // Close flashcard when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('flashcard-overlay')) {
            hidePremiumFlashcard();
        }
    });
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    const icon = elements.themeToggle.querySelector('i');
    const text = elements.themeToggle.querySelector('span');
    
    if (isDarkMode) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        text.textContent = 'Light Mode';
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        text.textContent = 'Dark Mode';
    }
}

function checkSavedTheme() {
    const savedTheme = localStorage.getItem('darkMode') === 'true';
    if (savedTheme) {
        document.body.classList.add('dark-mode');
        
        const icon = elements.themeToggle.querySelector('i');
        const text = elements.themeToggle.querySelector('span');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        text.textContent = 'Light Mode';
    }
}

function searchDocuments() {
    const query = elements.searchInput.value.trim().toLowerCase();
    
    if (query === '') {
        document.querySelectorAll('.document-card').forEach(card => {
            card.style.display = 'flex';
        });
        return;
    }
    
    document.querySelectorAll('.document-card').forEach(card => {
        const title = card.querySelector('.document-title').textContent.toLowerCase();
        const content = card.querySelector('.document-preview').textContent.toLowerCase();
        
        if (title.includes(query) || content.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    console.error(message);
}

// Core Dashboard Functions
async function initializeDashboard() {
    showLoading();
    try {
        checkSavedTheme();
        updateTimeGreeting();
        displayUsername();
        
        // Get user quota and subscription status
        await Promise.all([
            fetchUserQuota(),
            fetchUserSubscription(),
            fetchGeneratedContent()
        ]);
        
        // Update UI with user status
        updateUIWithUserStatus();
        
        // Check if user needs to upgrade
        checkIfNeedsUpgrade();
        
        setupEventListeners();
        
        // Update greeting every minute
        setInterval(updateTimeGreeting, 60000);
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showError('Failed to initialize dashboard');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    elements.documentsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Loading your documents...</h3>
        </div>
    `;
}

function hideLoading() {
    // Hide loading state
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', initializeAuth);