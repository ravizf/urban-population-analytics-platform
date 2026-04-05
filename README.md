# Urban Population Analytics Platform

Urban Population Analytics Platform is a Flask dashboard for exploring city and country population trends with interactive charts, comparisons, growth analysis, and forecast views.

## Stack

- Flask
- Flask-Login
- Flask-SQLAlchemy
- Flask-Bcrypt
- pandas
- Chart.js
- SQLite

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the app:

```bash
python app.py
```

4. Open `http://127.0.0.1:5000/login`

## Data Sources

- `population.csv`
  - Local CSV dataset used for city analytics and historical dashboard views.
  - Current tracked historical range is `2010-2026`.
  - The CSV currently includes estimated historical extension through 2026 for continuity across the dashboard.
- World Bank API
  - Used for the real-data country trend panel.
  - Indicator: `SP.POP.TOTL`

## Data Truth

- Historical city and country dashboard views use the CSV-backed dataset.
- World Bank trend charts use live API data for supported countries.
- Forecast charts and projection comparison panels use estimated values beyond the latest historical year.
- Forecast method: average annual change from the most recent years.

## Auth and Storage

- User accounts are stored in SQLite.
- Default database path: `instance/users.db`
- Passwords are hashed with Flask-Bcrypt.

## Verification

Run the lightweight route tests with:

```bash
python -m unittest discover -s tests
```

The tests cover:

- compare route success
- growth validation
- year-wise country growth
- forecast generation
- projection comparison beyond the historical endpoint
