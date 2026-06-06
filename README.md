# Urban Population Analytics Platform

Urban Population Analytics Platform is a Flask-based analytics dashboard for exploring city and country population trends through interactive charts, growth analysis, year snapshots, and future projections.

Repository:
[https://github.com/ravizf/urban-population-analytics-platform](https://github.com/ravizf/urban-population-analytics-platform)

## Overview

This project was built as an academic analytics platform that combines:

- user authentication
- city and country population dashboards
- growth comparison tools
- historical vs forecast visualization
- real country population trend support through the World Bank API

The platform is designed to make population records easier to understand through charts, insight cards, rankings, and comparison views.

## Features

- Secure login and registration
- Top 10 country population ranking
- Flexible leaderboard for cities and countries
- City-to-city comparison chart
- Growth calculator by year range
- City spotlight with latest, peak, and lowest values
- Year snapshot table and CSV export
- Country explorer with top cities and annual trend
- Year-wise country growth percentage
- World Bank real-data population trend
- Population forecast charts
- Projection comparison with historical vs dashed forecast lines
- PNG chart export
- Dark mode and responsive dashboard layout

## Tech Stack

- Flask
- Flask-Login
- Flask-SQLAlchemy
- Flask-Bcrypt
- pandas
- Chart.js
- SQLite
- HTML, CSS, JavaScript

## Project Structure

```text
app.py
population.csv
generate_data.py
requirements.txt
README.md
static/
templates/
tests/
```

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the project:

```bash
python app.py
```

4. Open the app in the browser:

```text
http://127.0.0.1:5000/login
```

## Deployment

The easiest way to deploy this Flask project is with Render.

### Render deployment steps

1. Push the project to GitHub.
2. Create a Render account and connect your GitHub account.
3. In Render, create a new `Web Service`.
4. Select this repository:

```text
https://github.com/ravizf/urban-population-analytics-platform
```

5. Use these service settings:

- Language: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`

6. Click `Create Web Service`.
7. After deployment finishes, Render will give you a public `onrender.com` URL.

### Notes for Render

- Render's Flask quickstart uses `gunicorn` for production serving, which is why this project includes `gunicorn` in `requirements.txt`. Source: [Render Flask docs](https://render.com/docs/deploy-flask)
- Render expects a web service to bind to a public port, and each service gets a public `onrender.com` subdomain. Source: [Render Web Services docs](https://render.com/docs/web-services?from=finddev.tools)
- Future pushes to your `main` branch can trigger automatic redeploys. Source: [Render deploy docs](https://render.com/docs/deploys)

## Data Sources

### Local dataset

- File: `population.csv`
- Used for city analytics and dashboard historical views
- Current historical range: `2010-2026`
- The local CSV includes estimated extension through 2026 for continuity across the visualizations

### Real API source

- Source: World Bank Open Data
- Indicator: `SP.POP.TOTL`
- Used in the real-data country trend panel

## Data Interpretation

- Historical city and country views use the CSV-backed dataset.
- Real-data country trend charts use live World Bank API data for supported countries.
- Forecast and projection panels use estimated values only after the latest historical year.
- Forecast method: average annual change from the most recent years.

## Authentication and Storage

- User accounts are stored in SQLite
- Default local database path: `instance/users.db`
- Passwords are hashed with Flask-Bcrypt

## Testing

Run the lightweight route tests with:

```bash
python -m unittest discover -s tests
```

Current tests cover:

- compare route success
- growth validation
- year-wise country growth
- forecast generation
- projection comparison beyond the historical endpoint

## Notes

- If the Python command is not available on your system, install Python and ensure it is added to `PATH`.
- If styles or scripts do not update after changes, restart the Flask app and hard refresh the browser with `Ctrl+F5`.
