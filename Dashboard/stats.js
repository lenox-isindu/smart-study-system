// Supabase Configuration
const SUPABASE_URL = "https://omcrqzojzbbsyznpriyf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3Jxem9qemJic3l6bnByaXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyODYxNzYsImV4cCI6MjA1Njg2MjE3Nn0.L7IQ0AZ1hg4SxZIwcz6lFw7qQbDlW-FkWlAKV0ZTi2I";



// Initialize Supabase correctly
let supabase; // Declare first

try {
    // Import Supabase client directly
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    console.error("Failed to initialize Supabase:", error);
    supabase = null;
}

// DOM Elements
const totalQuizzesEl = document.getElementById("total-quizzes");
const totalAttemptsEl = document.getElementById("total-attempts");
const avgScoreEl = document.getElementById("avg-score");
const bestScoreEl = document.getElementById("best-score");
const quizPerformanceBody = document.getElementById("quiz-performance-body");
const weakAreasList = document.getElementById("weak-areas");
const improvementPercentEl = document.getElementById("improvement-percent");
const sortQuizzesSelect = document.getElementById("sort-quizzes");

// Global variables
let allAttempts = [];
let quizStats = {};
let weakAreas = [];

// Format date to readable string
function formatDate(timestamp) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    return new Date(timestamp).toLocaleDateString('en-US', options);
}

// Load all user attempts
async function loadUserStats() {
    // Check if supabase is initialized
    if (!supabase) {
        console.error("Supabase not initialized");
        alert("Application not properly initialized. Please refresh the page.");
        return;
    }
    
    try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            console.error("Auth error:", authError);
            alert("Please log in to view your statistics");
            return;
        }
        
        if (!user) {
            alert("Please log in to view your statistics");
            return;
        }
        
        // Get all quiz attempts for this user with quiz names from generated_content
        const { data: attempts, error } = await supabase
            .from('quiz_attempts')
            .select(`
                *,
                generated_content:quiz_id (
                    file_name
                )
            `)
            .eq('user_id', user.id)
            .order('attempted_at', { ascending: false });
        
        if (error) {
            console.error("Error loading user stats:", error);
            alert("Error loading statistics. Please try again.");
            return;
        }
        
        // Process attempts
        allAttempts = attempts.map(attempt => ({
            ...attempt,
            quizName: attempt.generated_content?.file_name || "Unnamed Quiz",
            score: attempt.score,
            timestamp: new Date(attempt.attempted_at)
        }));
        
        // Calculate statistics
        calculateStatistics();
        displayStats();
        
    } catch (error) {
        console.error("Error loading user stats:", error);
        alert("Error loading statistics. Please try again.");
    }
}

// Calculate statistics from all attempts
function calculateStatistics() {
    // Reset stats
    quizStats = {};
    weakAreas = [];
    
    // Group attempts by quiz
    allAttempts.forEach(attempt => {
        if (!quizStats[attempt.quiz_id]) {
            quizStats[attempt.quiz_id] = {
                name: attempt.quizName,
                attempts: [],
                bestScore: 0,
                totalScore: 0,
                lastAttempt: null
            };
        }
        
        quizStats[attempt.quiz_id].attempts.push(attempt);
        quizStats[attempt.quiz_id].totalScore += attempt.score || 0;
        
        if (attempt.score > quizStats[attempt.quiz_id].bestScore) {
            quizStats[attempt.quiz_id].bestScore = attempt.score;
        }
        
        if (!quizStats[attempt.quiz_id].lastAttempt || 
            attempt.timestamp > quizStats[attempt.quiz_id].lastAttempt.timestamp) {
            quizStats[attempt.quiz_id].lastAttempt = attempt;
        }
    });
    
    // Calculate weak areas (quizzes with lowest average scores)
    weakAreas = Object.values(quizStats)
        .filter(quiz => quiz.attempts.length > 0)
        .map(quiz => ({
            name: quiz.name,
            avgScore: Math.round(quiz.totalScore / quiz.attempts.length),
            quizId: Object.keys(quizStats).find(key => quizStats[key] === quiz)
        }))
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3);
}

// Display all statistics
function displayStats() {
    // Overall stats
    const totalQuizzes = Object.keys(quizStats).length;
    const totalAttempts = allAttempts.length;
    const totalScore = allAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
    const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
    const bestScore = totalAttempts > 0 ? Math.max(...allAttempts.map(attempt => attempt.score || 0)) : 0;
    
    totalQuizzesEl.textContent = totalQuizzes;
    totalAttemptsEl.textContent = totalAttempts;
    avgScoreEl.textContent = `${avgScore}%`;
    bestScoreEl.textContent = `${bestScore}%`;
    
    // Quiz performance table
    displayQuizPerformance();
    
    // Weak areas
    displayWeakAreas();
    
    // Charts
    renderCharts();
    
    // Improvement percentage
    calculateImprovement();
}

// Display quiz performance table
function displayQuizPerformance() {
    quizPerformanceBody.innerHTML = "";
    
    const sortBy = sortQuizzesSelect.value;
    let sortedQuizzes = Object.values(quizStats);
    
    switch(sortBy) {
        case 'recent':
            sortedQuizzes.sort((a, b) => b.lastAttempt.timestamp - a.lastAttempt.timestamp);
            break;
        case 'best':
            sortedQuizzes.sort((a, b) => b.bestScore - a.bestScore);
            break;
        case 'worst':
            sortedQuizzes.sort((a, b) => a.bestScore - b.bestScore);
            break;
        case 'name':
            sortedQuizzes.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }
    
    sortedQuizzes.forEach(quiz => {
        const row = document.createElement("div");
        row.className = "table-row";
        
        const avgScore = quiz.attempts.length > 0 ? Math.round(quiz.totalScore / quiz.attempts.length) : 0;
        
        row.innerHTML = `
            <div class="col quiz-name">${quiz.name}</div>
            <div class="col attempts">${quiz.attempts.length}</div>
            <div class="col best-score">${quiz.bestScore}%</div>
            <div class="col avg-score">${avgScore}%</div>
            <div class="col last-attempt">${formatDate(quiz.lastAttempt.timestamp)}</div>
        `;
        
        quizPerformanceBody.appendChild(row);
    });
}

// Display weak areas
function displayWeakAreas() {
    weakAreasList.innerHTML = "";
    
    if (weakAreas.length === 0) {
        weakAreasList.innerHTML = "<p>No weak areas identified yet. Keep practicing!</p>";
        return;
    }
    
    weakAreas.forEach(area => {
        const areaEl = document.createElement("div");
        areaEl.className = "weak-area";
        areaEl.innerHTML = `
            <span class="weak-area-name">${area.name}</span>
            <span class="weak-area-score">${area.avgScore}%</span>
        `;
        weakAreasList.appendChild(areaEl);
    });
}

// Calculate improvement over time
function calculateImprovement() {
    if (allAttempts.length < 2) {
        improvementPercentEl.textContent = "0%";
        return;
    }
    
    // Sort attempts by date
    const sortedAttempts = [...allAttempts].sort((a, b) => a.timestamp - b.timestamp);
    
    // Get first and last month's average
    const firstMonth = sortedAttempts[0].timestamp.getMonth();
    const firstMonthAttempts = sortedAttempts.filter(attempt => 
        attempt.timestamp.getMonth() === firstMonth
    );
    const firstMonthAvg = firstMonthAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / firstMonthAttempts.length;
    
    const lastMonth = sortedAttempts[sortedAttempts.length - 1].timestamp.getMonth();
    const lastMonthAttempts = sortedAttempts.filter(attempt => 
        attempt.timestamp.getMonth() === lastMonth
    );
    const lastMonthAvg = lastMonthAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / lastMonthAttempts.length;
    
    const improvement = ((lastMonthAvg - firstMonthAvg) / firstMonthAvg) * 100;
    improvementPercentEl.textContent = `${Math.round(improvement)}%`;
    
    // Color based on improvement
    if (improvement > 0) {
        improvementPercentEl.style.color = "#27ae60";
    } else if (improvement < 0) {
        improvementPercentEl.style.color = "#e74c3c";
    } else {
        improvementPercentEl.style.color = "#2c3e50";
    }
}

// Render charts
function renderCharts() {
    // Prepare data for charts
    const labels = [];
    const scores = [];
    
    // Sort attempts by date and group by month
    const sortedAttempts = [...allAttempts].sort((a, b) => a.timestamp - b.timestamp);
    const attemptsByMonth = {};
    
    sortedAttempts.forEach(attempt => {
        const date = attempt.timestamp;
        const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
        
        if (!attemptsByMonth[monthYear]) {
            attemptsByMonth[monthYear] = {
                count: 0,
                totalScore: 0,
                label: date.toLocaleString('default', { month: 'short', year: 'numeric' })
            };
        }
        
        attemptsByMonth[monthYear].count++;
        attemptsByMonth[monthYear].totalScore += attempt.score;
    });
    
    // Prepare data for progress chart
    const progressLabels = [];
    const progressData = [];
    
    Object.keys(attemptsByMonth).forEach(key => {
        progressLabels.push(attemptsByMonth[key].label);
        progressData.push(Math.round(attemptsByMonth[key].totalScore / attemptsByMonth[key].count));
    });
    
    // Progress Over Time Chart
    const progressCtx = document.getElementById('progressChart').getContext('2d');
    new Chart(progressCtx, {
        type: 'line',
        data: {
            labels: progressLabels,
            datasets: [{
                label: 'Average Score',
                data: progressData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
    
    // Score Distribution Chart
    const scoreRanges = [
        { min: 0, max: 49, label: '0-49%', count: 0 },
        { min: 50, max: 69, label: '50-69%', count: 0 },
        { min: 70, max: 89, label: '70-89%', count: 0 },
        { min: 90, max: 100, label: '90-100%', count: 0 }
    ];
    
    allAttempts.forEach(attempt => {
        const score = attempt.score;
        for (const range of scoreRanges) {
            if (score >= range.min && score <= range.max) {
                range.count++;
                break;
            }
        }
    });
    
    const scoreCtx = document.getElementById('scoreChart').getContext('2d');
    new Chart(scoreCtx, {
        type: 'doughnut',
        data: {
            labels: scoreRanges.map(range => range.label),
            datasets: [{
                data: scoreRanges.map(range => range.count),
                backgroundColor: [
                    '#e74c3c',
                    '#f39c12',
                    '#3498db',
                    '#27ae60'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Improvement Chart (last 6 months)
    const improvementLabels = progressLabels.slice(-6);
    const improvementData = progressData.slice(-6);
    
    const improvementCtx = document.getElementById('improvementChart').getContext('2d');
    new Chart(improvementCtx, {
        type: 'bar',
        data: {
            labels: improvementLabels,
            datasets: [{
                label: 'Average Score',
                data: improvementData,
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// Event Listeners
sortQuizzesSelect.addEventListener('change', () => {
    displayQuizPerformance();
});

// Initialize page after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if Supabase was initialized correctly
    if (!supabase) {
        console.error("Supabase initialization failed");
        alert("Application failed to initialize. Please refresh the page.");
        return;
    }
    
    // Load user stats
    loadUserStats();
});