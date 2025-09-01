document.addEventListener("DOMContentLoaded", () => {
  // Supabase initialization with chrome.storage
    // Supabase Configuration
   const SUPABASE_URL = "https://omcrqzojzbbsyznpriyf.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3Jxem9qemJic3l6bnByaXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyODYxNzYsImV4cCI6MjA1Njg2MjE3Nn0.L7IQ0AZ1hg4SxZIwcz6lFw7qQbDlW-FkWlAKV0ZTi2I";
   
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
    auth: {
      storage: {
        getItem: (key) => {
          return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => resolve(result[key]));
          });
        },
        setItem: (key, value) => {
          return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
          });
        },
        removeItem: (key) => {
          return new Promise((resolve) => {
            chrome.storage.local.remove([key], () => resolve());
          });
        }
      },
      autoRefreshToken: false
    }
  });

  // User elements
  const userInfo = document.getElementById("sidepanel-user-info");
  const userName = document.getElementById("sidepanel-user-name");
  const userPic = document.getElementById("sidepanel-user-pic");

  // Auth state management
  async function checkAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    user ? updateUI(user) : userInfo.style.display = "none";
  }

  function updateUI(user) {
    userInfo.style.display = "flex";
    userName.textContent = user.user_metadata.full_name || user.email;
    userPic.src = user.user_metadata.avatar_url || '';
  }

  // Initial check
  checkAuthState();

  // Auth state listener
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') checkAuthState();
    if (event === 'SIGNED_OUT') userInfo.style.display = "none";
  });



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateSidePanel") {
    console.log("Received quiz data:", message.content);
    
    const quizContainer = document.getElementById("quiz-container");
    const summaryContainer = document.getElementById("summary-container");
    
    if (message.contentType === "quiz") {
      quizContainer.innerHTML = ''; // Clear previous content
      summaryContainer.style.display = "none";
      
      // Create quiz header
      const quizHeader = document.createElement("div");
      quizHeader.className = "quiz-header";
      quizHeader.innerHTML = `
        <h2>${message.content.subject} Quiz</h2>
        <div class="quiz-stats">${message.content.questions.length} Questions</div>
      `;
      quizContainer.appendChild(quizHeader);

      // Create question elements
      message.content.questions.forEach((q, index) => {
        const questionEl = document.createElement("div");
        questionEl.className = "question-card";
        questionEl.innerHTML = `
          <div class="question-header">
            <span class="question-number">Question ${index + 1}</span>
            <div class="question-text">${q.question}</div>
          </div>
          <div class="options-container">
            ${Object.entries(q.options).map(([key, value]) => `
              <label class="option">
                <input type="radio" name="q${index}" value="${key}">
                <span class="option-key">${key}.</span>
                <span class="option-text">${value}</span>
              </label>
            `).join('')}
          </div>
          <div class="feedback" style="display: none;">
            <div class="explanation">${q.explanation}</div>
          </div>
        `;

        // Add answer validation
        const radios = questionEl.querySelectorAll('input[type="radio"]');
        const feedback = questionEl.querySelector('.feedback');
        
        radios.forEach(radio => {
          radio.addEventListener('change', () => {
            // Clear previous styles
            radios.forEach(r => {
              r.parentElement.classList.remove('correct', 'incorrect');
            });

            // Validate answer
            if (radio.value === q.answer) {
              radio.parentElement.classList.add('correct');
              feedback.innerHTML = `
                <div class="correct-message">Correct!</div>
                <div class="explanation">${q.explanation}</div>
              `;
            } else {
              radio.parentElement.classList.add('incorrect');
              feedback.innerHTML = `
                <div class="incorrect-message">Incorrect. Correct answer: ${q.answer}</div>
                <div class="explanation">${q.explanation}</div>
              `;
            }

            // Show feedback and disable inputs
            feedback.style.display = 'block';
            radios.forEach(r => r.disabled = true);
          });
        });

        quizContainer.appendChild(questionEl);
      });
      
      quizContainer.style.display = "block";
    }
    else if (message.contentType === "summary") {
      console.log("Processing summary data");
      
      // Clear containers and toggle visibility
      quizContainer.style.display = "none";
      summaryContainer.style.display = "block";
      summaryContainer.innerHTML = ''
      
      // Create summary header
      const summaryHeader = document.createElement("div");
      summaryHeader.className = "summary-header";
      summaryHeader.innerHTML = `
        <h2>${message.content.subject} Summary</h2>
      `;
      summaryContainer.appendChild(summaryHeader);

      // Create summary content
      const summaryContent = document.createElement("div");
      summaryContent.className = "summary-content";
      
      // Split summary text into paragraphs
      const paragraphs = message.content.summary.split('\n\n');
      paragraphs.forEach(paragraph => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        summaryContent.appendChild(p);
      });

      summaryContainer.appendChild(summaryContent);
    }
  }
});


})