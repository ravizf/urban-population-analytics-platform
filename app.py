import os
from flask import Flask, jsonify, redirect, render_template, request
from flask_bcrypt import Bcrypt
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
import json


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersecretkey")

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.session_protection = "strong"


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default="user")


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def load_population_data():
    data_path = os.environ.get("POPULATION_DATA_PATH", "population.csv")
    data = pd.read_csv(data_path)
    data = data.drop_duplicates().copy()
    data["City"] = data["City"].astype(str).str.strip()
    data["Country"] = data["Country"].astype(str).str.strip()
    data["Population"] = (
        data["Population"].astype(str).str.replace(",", "", regex=False)
    )
    data["Population"] = pd.to_numeric(data["Population"], errors="coerce")
    data["Year"] = pd.to_numeric(data["Year"], errors="coerce")
    data = data.dropna(subset=["City", "Country", "Population", "Year"]).copy()
    data["Population"] = data["Population"].astype(int)
    data["Year"] = data["Year"].astype(int)
    return data.sort_values(["City", "Year"]).reset_index(drop=True)


df = load_population_data()
years = sorted(df["Year"].unique().tolist())
cities = sorted(df["City"].unique().tolist())
countries = sorted(df["Country"].unique().tolist())
city_country_map = (
    df[["City", "Country"]].drop_duplicates().sort_values(["Country", "City"])
)
city_to_country = dict(city_country_map[["City", "Country"]].values.tolist())
world_bank_country_codes = {
    "Australia": "AU",
    "Brazil": "BR",
    "Canada": "CA",
    "China": "CN",
    "France": "FR",
    "Germany": "DE",
    "India": "IN",
    "Japan": "JP",
    "UK": "GB",
    "USA": "US",
}
world_bank_cache = {}


def build_dashboard_context():
    latest_year = years[-1]
    latest = df[df["Year"] == latest_year]
    total_population = int(latest["Population"].sum())
    total_cities = int(latest["City"].nunique())
    total_countries = int(latest["Country"].nunique())
    fastest_city = (
        latest.sort_values("Population", ascending=False).iloc[0]["City"]
        if not latest.empty
        else None
    )
    return {
        "cities": cities,
        "years": years,
        "countries": countries,
        "latest_year": latest_year,
        "stats": {
            "total_population": total_population,
            "city_count": total_cities,
            "country_count": total_countries,
            "top_city": fastest_city,
        },
        "real_data_countries": sorted(
            [country for country in countries if country in world_bank_country_codes]
        ),
        "projected_target_year": latest_year + 2,
        "dataset_meta": {
            "historical_source": "Local CSV dataset",
            "historical_source_file": os.path.basename(
                os.environ.get("POPULATION_DATA_PATH", "population.csv")
            ),
            "latest_historical_year": latest_year,
            "tracked_year_range": f"{years[0]}-{latest_year}",
            "city_record_count": int(len(df)),
            "data_mix": "CSV-backed historical data through 2026, World Bank API for real country trend, forecast for future estimates",
            "forecast_method": "Average annual change from the most recent years",
        },
    }


def fetch_world_bank_population(country_name):
    cached = world_bank_cache.get(country_name)
    if cached:
        return cached

    country_code = world_bank_country_codes.get(country_name)
    if not country_code:
        raise ValueError("Real population data is not configured for that country yet.")

    url = (
        "https://api.worldbank.org/v2/country/"
        f"{country_code}/indicator/SP.POP.TOTL?format=json&per_page=80"
    )

    try:
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError):
        raise ConnectionError("Unable to reach the World Bank API right now.")

    if not isinstance(payload, list) or len(payload) < 2 or not payload[1]:
        raise LookupError("No real population data was returned for that country.")

    rows = []
    for row in payload[1]:
        if row.get("value") is None:
            continue
        year = int(row["date"])
        if year < 2010:
            continue
        rows.append({"year": year, "population": int(row["value"])})

    rows.sort(key=lambda item: item["year"])
    if not rows:
        raise LookupError("No usable real population data was returned for that country.")

    first = rows[0]
    last = rows[-1]
    growth_percentage = (
        ((last["population"] - first["population"]) / first["population"]) * 100
        if first["population"]
        else 0
    )

    result = {
        "country": country_name,
        "country_code": country_code,
        "source": "World Bank API",
        "indicator": "SP.POP.TOTL",
        "years": [row["year"] for row in rows],
        "populations": [row["population"] for row in rows],
        "start_year": first["year"],
        "start_population": first["population"],
        "latest_year": last["year"],
        "latest_population": last["population"],
        "growth_percentage": round(growth_percentage, 2),
    }
    world_bank_cache[country_name] = result
    return result


def build_forecast(values, steps=3):
    if len(values) < 2:
        raise ValueError("At least two years of data are required to build a forecast.")

    deltas = [
        values[index] - values[index - 1]
        for index in range(1, len(values))
    ]
    recent_deltas = deltas[-3:] if len(deltas) >= 3 else deltas
    average_delta = sum(recent_deltas) / len(recent_deltas)
    last_value = values[-1]
    forecast_values = []

    for _ in range(steps):
        last_value = int(round(last_value + average_delta))
        forecast_values.append(last_value)

    return {
        "annual_change": int(round(average_delta)),
        "forecast_values": forecast_values,
    }


def build_projected_series(year_values, population_values, target_year):
    historical_years = [int(year) for year in year_values]
    historical_populations = [int(value) for value in population_values]
    latest_year = historical_years[-1]

    if target_year <= latest_year:
        return {
            "historical_years": historical_years,
            "historical_populations": historical_populations,
            "forecast_years": [],
            "forecast_populations": [],
            "annual_change": 0,
        }

    years_ahead = target_year - latest_year
    forecast = build_forecast(historical_populations, years_ahead)
    forecast_years = [latest_year + offset for offset in range(1, years_ahead + 1)]
    return {
        "historical_years": historical_years,
        "historical_populations": historical_populations,
        "forecast_years": forecast_years,
        "forecast_populations": forecast["forecast_values"],
        "annual_change": forecast["annual_change"],
    }


def build_year_snapshot(year):
    filtered = df[df["Year"] == year]
    total_population = int(filtered["Population"].sum())
    top_city_row = filtered.sort_values("Population", ascending=False).iloc[0]
    average_population = int(filtered["Population"].mean())
    top_cities = (
        filtered.sort_values("Population", ascending=False)[["City", "Country", "Population"]]
        .head(8)
    )
    return {
        "year": year,
        "city_count": int(filtered["City"].nunique()),
        "country_count": int(filtered["Country"].nunique()),
        "total_population": total_population,
        "average_population": average_population,
        "top_city": top_city_row["City"],
        "top_city_population": int(top_city_row["Population"]),
        "rows": [
            {
                "city": row["City"],
                "country": row["Country"],
                "population": int(row["Population"]),
            }
            for _, row in top_cities.iterrows()
        ],
    }


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"].strip()
        raw_password = request.form["password"]

        if len(username) < 3 or len(raw_password) < 4:
            return render_template(
                "register.html",
                error="Username must be at least 3 characters and password at least 4.",
            )

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return render_template(
                "register.html",
                error="Username already exists. Choose another one.",
            )

        password = bcrypt.generate_password_hash(raw_password).decode("utf-8")
        user = User(username=username, password=password)
        db.session.add(user)
        db.session.commit()
        return redirect("/login")

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect("/dashboard")

    if request.method == "POST":
        username = request.form["username"].strip()
        password = request.form["password"]

        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            return redirect("/dashboard")

        return render_template(
            "login.html",
            error="Invalid credentials. Check your username and password.",
        )

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect("/login")


@app.route("/")
def root():
    if current_user.is_authenticated:
        return redirect("/dashboard")
    return redirect("/login")


@app.route("/dashboard")
@login_required
def dashboard():
    context = build_dashboard_context()
    if current_user.role == "admin":
        users = User.query.order_by(User.username.asc()).all()
        return render_template("admin_dashboard.html", users=users, **context)
    return render_template("index.html", **context)


@app.route("/admin")
@login_required
def admin():
    if current_user.role != "admin":
        return "Access Denied", 403
    return redirect("/dashboard")


@app.route("/get_top10", methods=["POST"])
@login_required
def get_top10():
    year = int(request.json["year"])
    filtered = df[df["Year"] == year]

    if filtered.empty:
        return jsonify({"error": "No data for this year"}), 404

    country_data = (
        filtered.groupby("Country", as_index=False)["Population"].sum()
        .sort_values("Population", ascending=False)
        .head(10)
    )
    return jsonify(
        {
            "labels": country_data["Country"].tolist(),
            "populations": country_data["Population"].astype(int).tolist(),
            "year": year,
        }
    )


@app.route("/leaderboard", methods=["POST"])
@login_required
def leaderboard():
    year = int(request.json["year"])
    group_by = request.json.get("group_by", "country")
    limit = max(3, min(int(request.json.get("limit", 10)), 15))

    filtered = df[df["Year"] == year]
    if filtered.empty:
        return jsonify({"error": "No data for this year"}), 404

    if group_by == "city":
        grouped = (
            filtered.groupby(["City", "Country"], as_index=False)["Population"]
            .sum()
            .sort_values("Population", ascending=False)
            .head(limit)
        )
        labels = grouped["City"].tolist()
        meta = grouped["Country"].tolist()
    else:
        grouped = (
            filtered.groupby("Country", as_index=False)["Population"]
            .sum()
            .sort_values("Population", ascending=False)
            .head(limit)
        )
        labels = grouped["Country"].tolist()
        meta = [None] * len(grouped)

    return jsonify(
        {
            "year": year,
            "group_by": group_by,
            "labels": labels,
            "meta": meta,
            "populations": grouped["Population"].astype(int).tolist(),
        }
    )


@app.route("/compare", methods=["POST"])
@login_required
def compare():
    city1 = request.json["city1"]
    city2 = request.json["city2"]

    data1 = df[df["City"] == city1][["Year", "Population"]].rename(
        columns={"Population": "city1_pop"}
    )
    data2 = df[df["City"] == city2][["Year", "Population"]].rename(
        columns={"Population": "city2_pop"}
    )
    merged = data1.merge(data2, on="Year", how="inner").sort_values("Year")

    if merged.empty:
        return jsonify({"error": "No overlapping timeline found for those cities."}), 404

    return jsonify(
        {
            "years": merged["Year"].astype(int).tolist(),
            "city1_pop": merged["city1_pop"].astype(int).tolist(),
            "city2_pop": merged["city2_pop"].astype(int).tolist(),
        }
    )


@app.route("/growth", methods=["POST"])
@login_required
def growth():
    city = request.json["city"]
    start = int(request.json["start"])
    end = int(request.json["end"])

    if start >= end:
        return jsonify({"error": "End year must be later than start year."}), 400

    start_data = df[(df["City"] == city) & (df["Year"] == start)]
    end_data = df[(df["City"] == city) & (df["Year"] == end)]

    if start_data.empty or end_data.empty:
        return jsonify({"error": "Invalid year selected"}), 404

    start_pop = int(start_data["Population"].iloc[0])
    end_pop = int(end_data["Population"].iloc[0])
    growth_rate = ((end_pop - start_pop) / start_pop) * 100

    return jsonify(
        {
            "growth_rate": round(growth_rate, 2),
            "population_change": end_pop - start_pop,
            "start_pop": start_pop,
            "end_pop": end_pop,
        }
    )


@app.route("/get_cities_by_country", methods=["POST"])
@login_required
def get_cities_by_country():
    country = request.json.get("country", "").strip()
    filtered = city_country_map
    if country:
        filtered = filtered[filtered["Country"] == country]
    return jsonify(filtered["City"].tolist())


@app.route("/search_cities")
@login_required
def search_cities():
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify([])

    matches = city_country_map[
        city_country_map["City"].str.lower().str.contains(query, regex=False)
    ].head(8)
    return jsonify(
        [
            {"city": row["City"], "country": row["Country"]}
            for _, row in matches.iterrows()
        ]
    )


@app.route("/city_details", methods=["POST"])
@login_required
def city_details():
    city = request.json["city"]
    city_data = df[df["City"] == city].sort_values("Year")

    if city_data.empty:
        return jsonify({"error": "City not found"}), 404

    peak_row = city_data.loc[city_data["Population"].idxmax()]
    low_row = city_data.loc[city_data["Population"].idxmin()]
    latest_row = city_data.iloc[-1]
    first_row = city_data.iloc[0]

    return jsonify(
        {
            "city": city,
            "country": city_to_country.get(city, "Unknown"),
            "years": city_data["Year"].astype(int).tolist(),
            "populations": city_data["Population"].astype(int).tolist(),
            "first_year": int(first_row["Year"]),
            "first_population": int(first_row["Population"]),
            "latest_year": int(latest_row["Year"]),
            "latest_population": int(latest_row["Population"]),
            "peak_year": int(peak_row["Year"]),
            "peak_population": int(peak_row["Population"]),
            "lowest_year": int(low_row["Year"]),
            "lowest_population": int(low_row["Population"]),
        }
    )


@app.route("/year_snapshot", methods=["POST"])
@login_required
def year_snapshot():
    year = int(request.json["year"])
    filtered = df[df["Year"] == year]
    if filtered.empty:
        return jsonify({"error": "No data for this year"}), 404
    return jsonify(build_year_snapshot(year))


@app.route("/country_growth_by_year", methods=["POST"])
@login_required
def country_growth_by_year():
    year = int(request.json["year"])
    if year <= years[0]:
        return jsonify(
            {"error": f"Growth percentage is available from {years[1]} onward."}
        ), 400

    current = (
        df[df["Year"] == year]
        .groupby("Country", as_index=False)["Population"]
        .sum()
        .rename(columns={"Population": "current_population"})
    )
    previous = (
        df[df["Year"] == (year - 1)]
        .groupby("Country", as_index=False)["Population"]
        .sum()
        .rename(columns={"Population": "previous_population"})
    )

    merged = current.merge(previous, on="Country", how="inner")
    if merged.empty:
        return jsonify({"error": "No comparable country data for selected year."}), 404

    merged["growth_percentage"] = (
        (merged["current_population"] - merged["previous_population"])
        / merged["previous_population"]
    ) * 100
    merged = merged.sort_values("growth_percentage", ascending=False)

    return jsonify(
        {
            "year": year,
            "previous_year": year - 1,
            "rows": [
                {
                    "country": row["Country"],
                    "previous_population": int(row["previous_population"]),
                    "current_population": int(row["current_population"]),
                    "growth_percentage": round(float(row["growth_percentage"]), 2),
                }
                for _, row in merged.iterrows()
            ],
        }
    )


@app.route("/country_insights", methods=["POST"])
@login_required
def country_insights():
    country = request.json["country"]
    country_data = df[df["Country"] == country].copy()

    if country_data.empty:
        return jsonify({"error": "Country not found"}), 404

    yearly = (
        country_data.groupby("Year", as_index=False)["Population"].sum()
        .sort_values("Year")
    )
    latest_year = int(yearly["Year"].max())
    latest_cities = (
        country_data[country_data["Year"] == latest_year]
        .sort_values("Population", ascending=False)
        .head(5)
    )

    return jsonify(
        {
            "country": country,
            "years": yearly["Year"].astype(int).tolist(),
            "populations": yearly["Population"].astype(int).tolist(),
            "city_count": int(country_data["City"].nunique()),
            "latest_year": latest_year,
            "top_cities": latest_cities["City"].tolist(),
            "top_city_populations": latest_cities["Population"].astype(int).tolist(),
        }
    )


@app.route("/real_population_trend", methods=["POST"])
@login_required
def real_population_trend():
    country = request.json.get("country", "").strip()
    if not country:
        return jsonify({"error": "Select a country to load real population data."}), 400

    try:
        return jsonify(fetch_world_bank_population(country))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except ConnectionError as error:
        return jsonify({"error": str(error)}), 503
    except LookupError as error:
        return jsonify({"error": str(error)}), 404


@app.route("/population_forecast", methods=["POST"])
@login_required
def population_forecast():
    mode = request.json.get("mode", "city").strip().lower()
    name = request.json.get("name", "").strip()
    years_ahead = max(1, min(int(request.json.get("years_ahead", 3)), 5))

    if not name:
        return jsonify({"error": "Select a city or country to generate a forecast."}), 400

    if mode == "country":
        base = (
            df[df["Country"] == name]
            .groupby("Year", as_index=False)["Population"]
            .sum()
            .sort_values("Year")
        )
    else:
        mode = "city"
        base = (
            df[df["City"] == name][["Year", "Population"]]
            .sort_values("Year")
            .copy()
        )

    if base.empty:
        return jsonify({"error": f"{mode.title()} not found in the dataset."}), 404

    base_years = base["Year"].astype(int).tolist()
    base_populations = base["Population"].astype(int).tolist()

    try:
        forecast = build_forecast(base_populations, years_ahead)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    forecast_years = [base_years[-1] + offset for offset in range(1, years_ahead + 1)]
    return jsonify(
        {
            "mode": mode,
            "name": name,
            "historical_years": base_years,
            "historical_populations": base_populations,
            "forecast_years": forecast_years,
            "forecast_populations": forecast["forecast_values"],
            "latest_year": base_years[-1],
            "latest_population": base_populations[-1],
            "annual_change": forecast["annual_change"],
            "method": "Average annual change from the most recent years",
        }
    )


@app.route("/compare_projection", methods=["POST"])
@login_required
def compare_projection():
    mode = request.json.get("mode", "city").strip().lower()
    first_name = request.json.get("first_name", "").strip()
    second_name = request.json.get("second_name", "").strip()
    target_year = int(request.json.get("target_year", years[-1] + 2))

    if not first_name or not second_name:
        return jsonify({"error": "Select two items to compare through the target year."}), 400

    if mode == "country":
        first_base = (
            df[df["Country"] == first_name]
            .groupby("Year", as_index=False)["Population"]
            .sum()
            .sort_values("Year")
        )
        second_base = (
            df[df["Country"] == second_name]
            .groupby("Year", as_index=False)["Population"]
            .sum()
            .sort_values("Year")
        )
    else:
        mode = "city"
        first_base = (
            df[df["City"] == first_name][["Year", "Population"]]
            .sort_values("Year")
            .copy()
        )
        second_base = (
            df[df["City"] == second_name][["Year", "Population"]]
            .sort_values("Year")
            .copy()
        )

    if first_base.empty or second_base.empty:
        return jsonify({"error": "One or both selected items were not found in the dataset."}), 404

    try:
        first_projection = build_projected_series(
            first_base["Year"].tolist(),
            first_base["Population"].tolist(),
            target_year,
        )
        second_projection = build_projected_series(
            second_base["Year"].tolist(),
            second_base["Population"].tolist(),
            target_year,
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    final_first = (
        first_projection["forecast_populations"][-1]
        if first_projection["forecast_populations"]
        else first_projection["historical_populations"][-1]
    )
    final_second = (
        second_projection["forecast_populations"][-1]
        if second_projection["forecast_populations"]
        else second_projection["historical_populations"][-1]
    )

    return jsonify(
        {
            "mode": mode,
            "target_year": target_year,
            "first_name": first_name,
            "second_name": second_name,
            "first": first_projection,
            "second": second_projection,
            "projected_leader": first_name if final_first >= final_second else second_name,
            "projected_gap": abs(final_first - final_second),
            "method": "Average annual change from the most recent years",
        }
    )


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True)
