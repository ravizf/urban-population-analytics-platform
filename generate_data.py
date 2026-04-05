import random

import pandas as pd


cities = {
    "India": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata"],
    "USA": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
    "Japan": ["Tokyo", "Osaka", "Nagoya", "Sapporo", "Fukuoka"],
    "UK": ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"],
    "Germany": ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"],
    "China": ["Shanghai", "Beijing", "Shenzhen", "Guangzhou", "Chengdu"],
    "Brazil": ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"],
    "Canada": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
    "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
    "France": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
}

data = []

for country, city_list in cities.items():
    for city in city_list:
        population = random.randint(1_000_000, 15_000_000)

        for year in range(2010, 2027):
            growth = random.randint(50_000, 300_000)
            population += growth
            data.append([city, country, year, population])

df = pd.DataFrame(data, columns=["City", "Country", "Year", "Population"])
df.to_csv("population.csv", index=False)

print("population.csv created successfully through 2026.")
