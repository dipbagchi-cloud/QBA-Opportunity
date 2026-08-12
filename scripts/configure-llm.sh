#!/bin/bash
#
# Point the Q-CRM chatbot at an OpenAI-compatible model provider.
#
# The bot reads LLM_API_URL / LLM_API_KEY / LLM_MODEL from the backend .env, so
# switching providers is configuration, not code — no rebuild, no redeploy.
#
# Run this ON THE VM so the key never travels through a chat log, a ticket or a
# commit. It is written only to the backend .env files, which are already
# outside git.
#
# Usage:
#   ./configure-llm.sh <provider> <api-key> [env...]
#
#   provider : groq | gemini | openai
#   env      : app (production) | qa | uat   — defaults to qa only
#
# Examples:
#   ./configure-llm.sh groq gsk_xxx qa            # QA only, to try it out
#   ./configure-llm.sh groq gsk_xxx qa uat app    # everywhere
#   ./configure-llm.sh openai sk-xxx app
#
# To go back to deterministic-only (no network calls at all):
#   ./configure-llm.sh off "" qa uat app
set -uo pipefail

PROVIDER="${1:?provider required: groq | gemini | openai | off}"
API_KEY="${2-}"
shift 2 || true
ENVS=("$@")
[ ${#ENVS[@]} -eq 0 ] && ENVS=(qa)

case "$PROVIDER" in
    groq)
        URL="https://api.groq.com/openai/v1"
        # A capable instruct model with solid JSON/tool behaviour, which is what
        # the intent parser needs. Change MODEL if your account offers another.
        MODEL="llama-3.3-70b-versatile"
        ;;
    gemini)
        URL="https://generativelanguage.googleapis.com/v1beta/openai"
        MODEL="gemini-2.0-flash"
        ;;
    openai)
        URL=""                      # SDK default
        MODEL="gpt-4o-mini"
        ;;
    off)
        URL=""; MODEL=""
        ;;
    *)
        echo "Unknown provider '$PROVIDER' (expected groq | gemini | openai | off)"; exit 1 ;;
esac

if [ "$PROVIDER" != "off" ] && [ -z "$API_KEY" ]; then
    echo "An API key is required for provider '$PROVIDER'."; exit 1
fi

# Replace a key in place if present, otherwise append. Never duplicates a line,
# and never prints the key.
set_env() {
    local file="$1" key="$2" value="$3"
    if grep -qE "^${key}=" "$file"; then
        # Delimiter is | because URLs contain /
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
}

for ENV in "${ENVS[@]}"; do
    DIR="/home/azureuser/$ENV/backend"
    ENV_FILE="$DIR/.env"
    if [ ! -f "$ENV_FILE" ]; then
        echo "[$ENV] no .env at $ENV_FILE — skipped"; continue
    fi

    cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"

    if [ "$PROVIDER" = "off" ]; then
        set_env "$ENV_FILE" LLM_ENABLED false
        echo "[$ENV] external model DISABLED — answers come from the deterministic engine only"
    else
        set_env "$ENV_FILE" LLM_ENABLED true
        set_env "$ENV_FILE" LLM_API_KEY "$API_KEY"
        set_env "$ENV_FILE" LLM_MODEL "$MODEL"
        [ -n "$URL" ] && set_env "$ENV_FILE" LLM_API_URL "$URL"
        echo "[$ENV] provider=$PROVIDER model=$MODEL (key written, not shown)"
    fi

    # Name maps to the PM2 process: app -> qcrm-backend, qa -> qcrm-qa-backend.
    case "$ENV" in
        app) PM2_NAME="qcrm-backend";     PORT=3001 ;;
        qa)  PM2_NAME="qcrm-qa-backend";  PORT=3003 ;;
        uat) PM2_NAME="qcrm-uat-backend"; PORT=3005 ;;
        *)   echo "[$ENV] unknown environment, not restarting"; continue ;;
    esac

    echo "[$ENV] restarting $PM2_NAME…"
    bash "/home/azureuser/$ENV/scripts/pm2-safe-restart.sh" "$PM2_NAME" "$PORT" \
        "/home/azureuser/$ENV/ecosystem.config.js" 2>&1 | tail -1

    # Confirm the backend came back, and report what the bot now thinks it has.
    sleep 2
    node -e "
        const http = require('http');
        http.get({host:'127.0.0.1', port:$PORT, path:'/api/public/stats', timeout:10000},
            r => console.log('[$ENV] backend HTTP ' + r.statusCode))
          .on('error', e => console.log('[$ENV] backend ERROR: ' + e.message));
    " 2>/dev/null
done

echo
echo "Done. Ask the bot something and watch which path answered:"
echo "  pm2 logs qcrm-qa-backend --lines 30 --nostream | grep -i chatbot"
echo "A line saying 'falling back to NLP' means the model was not reachable and"
echo "the deterministic engine answered instead — the reply is still correct."
