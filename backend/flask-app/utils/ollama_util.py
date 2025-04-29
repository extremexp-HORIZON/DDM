import requests
import time
import traceback
import os
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")


def ensure_mistral_loaded(model_name="mistral", timeout=300):
    try:
        print("🔎 Checking if model is already loaded...")
        response = requests.get("http://ollama:11434/api/tags")
        response.raise_for_status()

        models = response.json().get("models", [])
        print("📦 Available models:", [m["name"] for m in models])

        if not any(model_name in m["name"] for m in models):
            print(f"🔄 Pulling model '{model_name}' from Ollama...")
            pull_response = requests.post(
                "http://ollama:11434/api/pull",
                headers={"Content-Type": "application/json"},
                json={"name": model_name}
            )
            pull_response.raise_for_status()

            # Wait until the model is loaded
            start_time = time.time()
            while time.time() - start_time < timeout:
                time.sleep(5)
                response = requests.get("http://ollama:11434/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
                if any(model_name in m["name"] for m in models):
                    print(f"✅ Model '{model_name}' is ready!")
                    return
            print("⏳ Timed out waiting for the model to load.")
        else:
            print(f"✅ Model '{model_name}' already loaded.")

    except Exception as e:
        print("❌ Ollama not ready or error during model loading:")
        traceback.print_exc()


def wait_for_ollama_ready(timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get("http://ollama:11434")
            if r.status_code == 200:
                print("✅ Ollama is ready!")
                return
        except Exception:
            pass
        print("⏳ Waiting for Ollama...")
        time.sleep(5)
    raise RuntimeError("❌ Ollama not reachable after timeout")


