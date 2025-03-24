#!/bin/bash

# Make sure your OpenAI API key is available
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY environment variable is not set."
  echo "Please set it by running: export OPENAI_API_KEY=your_api_key"
  exit 1
fi

# Create a local .env file with the OpenAI API key
echo "RESPONSES_API_KEY=$OPENAI_API_KEY" > .env

# Build and start the Docker container
docker-compose up -d --build

echo "Channel Factory JIRA Guru app is now running at http://localhost:3000"
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down" 