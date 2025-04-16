#!/bin/bash

set -e

export OLLAMA_MMAP=true
# Start Ollama server in background
ollama serve &

# Wait for Ollama API to be available
until curl -sf http://localhost:11434/api/tags > /dev/null; do
  echo "⏳ Waiting for Ollama server..."
  sleep 2
done

echo "✅ Ollama server is up!"

# Pull the mistral model if it's not already present
if ! ollama list | grep -q "mistral"; then
  echo "⬇️ Pulling mistral model..."
  ollama pull mistral
else
  echo "✅ Mistral model already pulled!"
fi

# Wait until model is fully loaded
until ollama list | grep -q "mistral"; do
  echo "⏳ Waiting for Mistral to finish pulling..."
  sleep 2
done

echo "🚀 Ollama and Mistral are ready to go!"

# Wait for any background processes to finish (like `ollama serve`)
wait
