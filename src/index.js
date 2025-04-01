require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Add an array to store recent application logs
const appLogs = [];
const MAX_LOGS = 100; // Maximum number of logs to keep in memory

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'jiragurusecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Add a function to log messages with timestamps
function logMessage(type, message, details = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  
  // Add to in-memory logs
  appLogs.unshift(logEntry);
  if (appLogs.length > MAX_LOGS) {
    appLogs.pop();
  }
  
  // Also log to console
  console.log(`${logEntry.timestamp} [${type}] ${message}`);
  if (details) console.log(details);
}

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.RESPONSES_API_KEY
});

// Login page route - must be before auth middleware
app.get('/login', (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CF JIRA Guru - Login</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          background-color: #000000;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #ff0000;
          margin-right: 15px;
          padding: 10px;
          border: 2px solid #ffffff;
          border-radius: 8px;
        }
        h1 {
          color: #ff0000;
          margin: 0;
        }
        .card {
          border: 1px solid #ffffff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 3px 6px rgba(255,255,255,0.2);
          background-color: #121212;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        input[type="text"],
        input[type="password"] {
          padding: 12px;
          border: 1px solid #ffffff;
          border-radius: 6px;
          font-size: 16px;
          background-color: #333333;
          color: #ffffff;
          transition: border-color 0.3s;
        }
        input[type="text"]:focus,
        input[type="password"]:focus {
          border-color: #ff0000;
          outline: none;
        }
        .btn {
          background-color: #ff0000;
          color: white;
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.3s;
          text-align: center;
        }
        .btn:hover {
          background-color: #cc0000;
        }
        .error-message {
          color: #ff0000;
          background-color: rgba(255, 0, 0, 0.1);
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
          display: ${req.query.error ? 'block' : 'none'};
        }
        .footer {
          margin-top: auto;
          text-align: center;
          color: #999999;
          font-size: 14px;
          padding: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">CF</div>
        <h1>JIRA Guru Login</h1>
      </div>
      
      <div class="card">
        <div class="error-message">
          Invalid username or password. Please try again.
        </div>
        
        <form class="login-form" action="/login" method="POST">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <button type="submit" class="btn">Login</button>
        </form>
      </div>
      
      <div class="footer">
        © ${new Date().getFullYear()} Channel Factory | Powered by JIRA Guru
      </div>
    </body>
    </html>
  `);
});

// Login POST handler - must be before auth middleware
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'jiraguru') {
    req.session.isAuthenticated = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

// Logout route - must be before auth middleware
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Authentication middleware - after login routes
function requireAuth(req, res, next) {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
}

// Apply authentication middleware to all routes except login
app.use((req, res, next) => {
  if (req.path === '/login') {
    return next();
  }
  requireAuth(req, res, next);
});

// Protected routes below this line
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CF JIRA Guru Assistant</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          background-color: #000000;
          color: #ffffff;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .logo-section {
          display: flex;
          align-items: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #ff0000;
          margin-right: 15px;
          padding: 10px;
          border: 2px solid #ffffff;
          border-radius: 8px;
        }
        .logout-btn {
          background-color: #333333;
          color: white;
          padding: 8px 16px;
          border: 1px solid #ffffff;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          font-size: 14px;
        }
        .logout-btn:hover {
          background-color: #444444;
        }
        h1 {
          color: #ff0000;
          margin: 0;
        }
        .card {
          border: 1px solid #ffffff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 3px 6px rgba(255,255,255,0.2);
          background-color: #121212;
        }
        .btn {
          background-color: #ff0000;
          color: white;
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          font-weight: bold;
          transition: background-color 0.3s;
        }
        .btn:hover {
          background-color: #cc0000;
        }
        .search-form {
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
        }
        input[type="text"] {
          padding: 12px;
          flex-grow: 1;
          border: 1px solid #ffffff;
          border-radius: 6px;
          font-size: 16px;
          background-color: #333333;
          color: #ffffff;
        }
        input[type="text"]:focus {
          border-color: #ff0000;
          outline: none;
        }
        #response-container {
          display: none;
          margin-top: 20px;
        }
        .loading {
          text-align: center;
          padding: 20px;
          font-style: italic;
          color: #999999;
        }
        .error-message {
          color: #ff0000;
          background-color: rgba(255, 0, 0, 0.1);
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999999;
          font-size: 14px;
        }
        .response-section {
          margin-top: 30px;
        }
        
        .response-section h3 {
          color: #ff0000;
          margin-bottom: 15px;
          font-size: 1.2em;
        }
        
        .question-text {
          font-style: italic;
          background-color: #1a1a1a;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 25px;
          border-left: 4px solid #ff0000;
        }
        
        .analysis-content {
          line-height: 1.6;
          margin-bottom: 25px;
        }
        
        .analysis-content h4 {
          color: #ff0000;
          margin: 30px 0 15px 0;
          font-size: 1.3em;
          border-bottom: 1px solid #333333;
          padding-bottom: 8px;
        }
        
        .analysis-content h4:first-child {
          margin-top: 0;
        }
        
        .analysis-content h5 {
          color: #ffffff;
          margin: 20px 0 10px 0;
          font-size: 1.1em;
        }
        
        .analysis-content p {
          margin: 0 0 15px 0;
          text-align: justify;
        }
        
        .analysis-content ul {
          margin: 0 0 20px 20px;
          padding: 0;
        }
        
        .analysis-content li {
          margin-bottom: 10px;
          line-height: 1.5;
        }
        
        .analysis-content strong {
          color: #ff6666;
          font-weight: normal;
        }
        
        .ticket-reference {
          background-color: #333333;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.9em;
          border: 1px solid #666666;
          white-space: nowrap;
        }
        
        .response-actions {
          display: flex;
          gap: 10px;
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #333333;
        }
        
        .btn-secondary {
          background-color: #333333;
          border: 1px solid #ffffff;
        }
        
        .btn-secondary:hover {
          background-color: #444444;
        }
        
        .btn-outline {
          background-color: transparent;
          border: 1px solid #ff0000;
          color: #ff0000;
        }
        
        .btn-outline:hover {
          background-color: #ff0000;
          color: #ffffff;
        }
        
        .feedback-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.8);
          z-index: 1000;
        }
        
        .modal-content {
          background-color: #121212;
          margin: 10% auto;
          padding: 20px;
          border: 1px solid #ffffff;
          border-radius: 8px;
          max-width: 500px;
          position: relative;
        }
        
        .modal-close {
          position: absolute;
          right: 15px;
          top: 10px;
          font-size: 24px;
          cursor: pointer;
          color: #666666;
        }
        
        .modal-close:hover {
          color: #ffffff;
        }
        
        textarea {
          width: 100%;
          min-height: 100px;
          margin: 15px 0;
          padding: 10px;
          background-color: #333333;
          border: 1px solid #666666;
          border-radius: 4px;
          color: #ffffff;
          font-family: inherit;
        }
        
        textarea:focus {
          border-color: #ff0000;
          outline: none;
        }
        
        /* Improve readability on mobile */
        @media (max-width: 768px) {
          .analysis-content {
            font-size: 0.95em;
          }
          
          .analysis-content h4 {
            font-size: 1.2em;
          }
          
          .analysis-content h5 {
            font-size: 1.05em;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <div class="logo">CF</div>
          <h1>JIRA Guru Assistant</h1>
        </div>
        <a href="/logout" class="logout-btn">Logout</a>
      </div>
      
      <div class="card">
        <h2>About</h2>
        <p>This application helps answer questions about Channel Factory JIRA tickets by providing smart, clear, and comprehensive summaries using advanced analysis techniques.</p>
      </div>
      
      <div class="card">
        <h2>Ask a Question</h2>
        <form id="question-form" class="search-form">
          <input type="text" name="question" id="question-input" placeholder="e.g., How have we historically dealt with failed deployments in QA?" required>
          <button type="submit" class="btn">Ask</button>
        </form>
        
        <div id="response-container">
          <div class="loading" id="loading-indicator">Analyzing your question...</div>
          <div id="analysis-result"></div>
        </div>
      </div>
      
      <div class="footer">
        © ${new Date().getFullYear()} Channel Factory | Powered by JIRA Guru
      </div>
      
      <!-- Feedback Modal -->
      <div id="feedback-modal" class="feedback-modal">
        <div class="modal-content">
          <span class="modal-close" onclick="closeFeedbackModal()">&times;</span>
          <h3>Provide Feedback</h3>
          <p>Please share your thoughts on this response:</p>
          <textarea id="feedback-text" placeholder="Your feedback helps us improve..."></textarea>
          <button onclick="submitFeedback()" class="btn">Submit Feedback</button>
        </div>
      </div>
      
      <script>
        let currentResponseId = null;
        
        document.getElementById('question-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const questionInput = document.getElementById('question-input');
          const responseContainer = document.getElementById('response-container');
          const loadingIndicator = document.getElementById('loading-indicator');
          const analysisResult = document.getElementById('analysis-result');
          
          // Show loading state
          responseContainer.style.display = 'block';
          loadingIndicator.style.display = 'block';
          analysisResult.style.display = 'none';
          
          try {
            const response = await fetch('/ask-question', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                question: questionInput.value
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to get response');
            }
            
            const result = await response.json();
            currentResponseId = result.responseId;
            
            // Hide loading and show result
            loadingIndicator.style.display = 'none';
            analysisResult.style.display = 'block';
            analysisResult.innerHTML = result.analysis;
            
          } catch (error) {
            console.error('Error:', error);
            loadingIndicator.style.display = 'none';
            analysisResult.style.display = 'block';
            analysisResult.innerHTML = '<div class="error-message">Sorry, there was an error analyzing your question. Please try again later.</div>';
          }
        });
        
        function clearResponse() {
          const questionInput = document.getElementById('question-input');
          const responseContainer = document.getElementById('response-container');
          const analysisResult = document.getElementById('analysis-result');
          
          questionInput.value = '';
          responseContainer.style.display = 'none';
          analysisResult.innerHTML = '';
          currentResponseId = null;
        }
        
        function provideFeedback(responseId) {
          document.getElementById('feedback-modal').style.display = 'block';
          currentResponseId = responseId;
        }
        
        function closeFeedbackModal() {
          document.getElementById('feedback-modal').style.display = 'none';
          document.getElementById('feedback-text').value = '';
        }
        
        async function submitFeedback() {
          const feedbackText = document.getElementById('feedback-text').value.trim();
          
          if (!feedbackText) {
            alert('Please enter your feedback before submitting.');
            return;
          }
          
          try {
            const response = await fetch('/api/feedback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                responseId: currentResponseId,
                feedback: feedbackText,
                question: document.getElementById('question-input').value
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to submit feedback');
            }
            
            alert('Thank you for your feedback!');
            closeFeedbackModal();
            
          } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Sorry, there was an error submitting your feedback. Please try again.');
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Function to format the OpenAI response with proper structure
function formatAnalysisResponse(text) {
  // Split by section headers (marked with ##)
  const sections = text.split(/(?=##)/g);
  
  return sections.map(section => {
    // Format section headers
    section = section.replace(/##\s*([^#\n]+)/g, '<h4>$1</h4>');
    
    // Format subsection headers (marked with numbers and asterisks)
    section = section.replace(/(\d+\.\s*\*\*[^*]+\*\*)/g, '<h5>$1</h5>');
    
    // Format bullet points
    section = section.replace(/###\s*([^\n]+)/g, '<h5>$1</h5>');
    
    // Format ticket references
    section = section.replace(/CF-\d+/g, match => `<span class="ticket-reference">${match}</span>`);
    
    // Convert asterisk emphasis to proper HTML
    section = section.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Split into paragraphs and wrap them
    const paragraphs = section.split(/\n\s*\n/);
    return paragraphs.map(p => {
      if (p.trim().startsWith('<h')) return p;
      if (p.trim().startsWith('-')) {
        // Convert bullet points to list items
        const items = p.split(/\n\s*-\s*/).filter(item => item.trim());
        return '<ul>' + items.map(item => `<li>${item.trim()}</li>`).join('') + '</ul>';
      }
      return `<p>${p.trim()}</p>`;
    }).join('\n');
  }).join('\n');
}

// Update the ask-question endpoint
app.post('/ask-question', async (req, res) => {
  try {
    const { question } = req.body;
    console.log('Received question: "' + question + '"');
    
    // Generate a unique ID for this question/response
    const responseId = `response-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Get analysis from OpenAI
    const analysis = await getResponseFromOpenAI(question);
    
    // Format the analysis
    const formattedAnalysis = formatAnalysisResponse(analysis);
    
    // Return JSON response
    res.json({
      success: true,
      responseId,
      question,
      analysis: `
        <div class="response-section">
          <h3>Your Question</h3>
          <div class="question-text">${question}</div>
          
          <h3>Analysis</h3>
          <div class="analysis-content">
            ${formattedAnalysis}
          </div>
          
          <div class="response-actions">
            <button onclick="clearResponse()" class="btn btn-secondary">Ask Another Question</button>
            <button onclick="provideFeedback('${responseId}')" class="btn btn-outline">Provide Feedback</button>
          </div>
        </div>
      `
    });
    
  } catch (error) {
    console.error('Error analyzing question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze question'
    });
  }
});

// Add feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { responseId, feedback, question } = req.body;
    
    // Create feedback directory if it doesn't exist
    const feedbackDir = path.join(__dirname, 'feedback');
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }
    
    // Save feedback to file
    const feedbackPath = path.join(feedbackDir, `${responseId}.json`);
    fs.writeFileSync(feedbackPath, JSON.stringify({
      responseId,
      feedback,
      question,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to save feedback' });
  }
});

// Admin route to view logs (protected by basic auth)
app.get('/admin/logs', (req, res) => {
  res.json({ logs: appLogs });
});

// Function to get a response from OpenAI
async function getResponseFromOpenAI(question) {
  try {
    logMessage('INFO', "Sending question to OpenAI API", question);
    
    // Create a system message that provides context to the AI
    const systemMessage = `You are JIRA Guru, an AI assistant specialized in analyzing and providing insights about Channel Factory's JIRA tickets and development processes. 
    
Provide comprehensive, accurate, and helpful responses to questions about JIRA tickets, development workflows, and technical issues.

When responding:
1. Be specific and detailed in your explanations
2. If you don't have specific information, acknowledge that but provide general best practices
3. Format your responses with clear headings and bullet points when appropriate
4. Keep your tone professional and helpful`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const response = completion.choices[0].message.content;
    logMessage('INFO', "Received response from OpenAI", { 
      questionLength: question.length, 
      responseLength: response.length 
    });
    
    return response;
  } catch (error) {
    logMessage('ERROR', "Error getting response from OpenAI", error);
    return createFallbackResponse(question);
  }
}

// Function to create a fallback response if OpenAI API fails
function createFallbackResponse(question) {
  return `<p>I apologize, but I'm currently unable to provide a specific analysis for your question about "${question}".</p>
  
  <p>This could be due to one of the following reasons:</p>
  <ul>
    <li>The AI service is temporarily unavailable</li>
    <li>Your question requires more specific context that I don't currently have access to</li>
    <li>There might be an issue with the connection to our AI provider</li>
  </ul>
  
  <p>Please try again in a few minutes or rephrase your question to be more specific. Alternatively, you can contact the Channel Factory support team for direct assistance.</p>`;
}

// Start the server
app.listen(PORT, () => {
  logMessage('INFO', `JIRA Guru application listening on port ${PORT}`);
}); 