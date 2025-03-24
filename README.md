# Channel Factory JIRA Guru Assistant

A smart AI-powered assistant that answers questions about Channel Factory JIRA tickets by analyzing patterns across multiple tickets.

## Features

- Answers questions about JIRA tickets using combined insights
- Provides high-level summaries and pattern analysis
- User-friendly interface with Channel Factory branding
- Feedback system to rate responses
- Fallback mechanism when AI services are unavailable

## Deployment Options

### Local Development

```bash
# Install dependencies
npm install

# Start the app
npm start
```

### Docker Deployment (Recommended)

This is the easiest way to deploy the app and share it with your team.

#### Option 1: Using the deployment script

```bash
# Set your OpenAI API key as an environment variable
export OPENAI_API_KEY=your_actual_openai_api_key

# Run the deployment script
./deploy.sh
```

#### Option 2: Manual Docker setup

```bash
# Build the Docker image
docker build -t cf-jira-guru .

# Run the container
docker run -p 3000:3000 -e RESPONSES_API_KEY=your_openai_api_key cf-jira-guru
```

#### Option 3: Using Docker Compose

```bash
# Edit the docker-compose.yml file to add your OpenAI API key
# Then run:
docker-compose up -d
```

The app will be available at http://localhost:3000

### Sharing the App

To make the app available to others:

1. Deploy to a server with a public IP address
2. Use a reverse proxy like Nginx to add HTTPS
3. Consider using a cloud service like AWS, Digital Ocean, or Render

For a quick shareable solution, you can use a tool like ngrok:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# Start ngrok (after your app is running)
ngrok http 3000
```

This will give you a public URL that you can share with your team.

## Environment Variables

- `PORT`: The port to run the server on (default: 3000)
- `RESPONSES_API_KEY`: Your OpenAI API key (required for AI-powered responses)

## Troubleshooting

If you see API key errors, make sure your OpenAI API key is valid and correctly configured in your environment variables or .env file.

## Using with MCP

To configure this application to work with Cursor's MCP:

1. Ensure you have the Google Drive MCP properly configured in your Cursor settings
2. The MCP configuration should use a valid OAuth refresh token, not a GitHub token
3. Use the MCP to interact with the Google Drive folder at: https://drive.google.com/drive/folders/1cDVJHUgkyNyiKAduO1Qbqs7gFx_EthAM

## Features

- Connect to Google Drive using OAuth 2.0
- List files from a specific Google Drive folder
- View file details and open files in Google Drive

## Troubleshooting Google Drive MCP

If you're having issues with the Google Drive MCP in Cursor:

1. Make sure you're using the correct OAuth refresh token (not a GitHub token)
2. Verify that the folder ID is correct
3. Ensure you have appropriate permissions to access the folder 