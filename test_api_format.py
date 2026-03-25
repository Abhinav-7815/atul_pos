import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_login():
    print("Testing Login Response Format...")
    payload = {
        "email": "admin@atul.com",
        "password": "admin"
    }
    try:
        response = requests.post(f"{BASE_URL}/auth/login/", json=payload)
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

def test_categories():
    print("\nTesting Categories Response Format...")
    try:
        # We need a token, but let's see if 401 response is also wrapped
        response = requests.get(f"{BASE_URL}/menu/categories/")
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
    test_categories()
