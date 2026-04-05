import os
import uuid
import unittest

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_users.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app import app, bcrypt, db, User, cities  # noqa: E402


class DashboardRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        with app.app_context():
            db.drop_all()
            db.create_all()

    def setUp(self):
        self.client = app.test_client()
        self.username = f"tester_{uuid.uuid4().hex[:8]}"
        self.password = "pass1234"

        with app.app_context():
            user = User(
                username=self.username,
                password=bcrypt.generate_password_hash(self.password).decode("utf-8"),
            )
            db.session.add(user)
            db.session.commit()

        response = self.client.post(
            "/login",
            data={"username": self.username, "password": self.password},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)

    def test_compare_returns_historical_timeline(self):
        response = self.client.post(
            "/compare",
            json={"city1": cities[0], "city2": cities[1]},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["years"][-1], 2026)
        self.assertTrue(len(data["years"]) >= 2)

    def test_growth_rejects_invalid_range(self):
        response = self.client.post(
            "/growth",
            json={"city": cities[0], "start": 2026, "end": 2026},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("later than start year", response.get_json()["error"])

    def test_country_growth_by_year_uses_2026(self):
        response = self.client.post("/country_growth_by_year", json={"year": 2026})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["previous_year"], 2025)
        self.assertTrue(len(data["rows"]) > 0)

    def test_population_forecast_starts_after_latest_history(self):
        response = self.client.post(
            "/population_forecast",
            json={"mode": "city", "name": cities[0], "years_ahead": 3},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["latest_year"], 2026)
        self.assertEqual(data["forecast_years"], [2027, 2028, 2029])

    def test_projection_compare_extends_beyond_2026(self):
        response = self.client.post(
            "/compare_projection",
            json={
                "mode": "city",
                "first_name": cities[0],
                "second_name": cities[1],
                "target_year": 2028,
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["target_year"], 2028)
        self.assertEqual(data["first"]["historical_years"][-1], 2026)
        self.assertEqual(data["first"]["forecast_years"], [2027, 2028])


if __name__ == "__main__":
    unittest.main()
