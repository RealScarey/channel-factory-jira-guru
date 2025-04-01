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
      
      <script>
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
      </script>
    </body>
    </html>
  `);
});

// Modify the ask-question endpoint to return JSON
app.post('/ask-question', async (req, res) => {
  try {
    const { question } = req.body;
    console.log('Received question: "' + question + '"');
    
    // Get analysis from OpenAI
    const analysis = await getResponseFromOpenAI(question);
    
    // Return JSON response
    res.json({
      success: true,
      analysis: analysis
    });
    
  } catch (error) {
    console.error('Error analyzing question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze question'
    });
  }
});

// Route to receive feedback
app.post('/feedback', (req, res) => {
  try {
    const { responseId, question, feedback } = req.body;
    
    // Log the feedback
    logMessage('INFO', "Received feedback", { responseId, question, feedback });
    
    // Save feedback to file
    const feedbackFile = path.join(feedbackDir, `${responseId}.json`);
    fs.writeFileSync(feedbackFile, JSON.stringify({
      responseId,
      question,
      feedback,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    logMessage('ERROR', "Error saving feedback", error);
    res.status(500).json({ error: 'Failed to save feedback' });
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