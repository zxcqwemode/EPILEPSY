# Start command:

    git clone https://github.com/hmmrfll/EPILEPSY.git
    npm install

# Command to pull new data

    git remote add origin https://github.com/hmmrfll/hedgieBot-backend.git
    git branch -M main
    git add .
    git commit -m "some commit information"
    git push -u origin main

# Start with docker:

    docker compose up --build

# Telegram bot token
BOT_TOKEN=7429202451:AAGJGUO8-fHTMqOGEhu0hKPsfuk3KiaK3Hk

# PostgreSQL username
PG_USER=epilepsy

# Host for connecting to the PostgreSQL database
PG_HOST=db

# Name of the PostgreSQL database
PG_DATABASE=epilepsy-db

# Password for the PostgreSQL user
PG_PASSWORD=epilepsy123

# Internal port for PostgreSQL
PG_PORT=5432

# External port for PostgreSQL
PG_PORT_LOCAL=5433

# Internal port for the backend application
BACKEND_PORT=3001

# External port for the backend application
BACKEND_PORT_LOCAL=3001

