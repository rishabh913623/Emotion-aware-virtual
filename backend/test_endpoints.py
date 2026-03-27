#!/usr/bin/env python3
"""Test script to verify backend endpoints."""
import requests
import sys

BASE_URL = "http://localhost:10000"

def test_root():
    """Test root endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✓ Root route: {response.status_code} - {response.json()}")
        assert response.status_code == 200
        assert response.json() == {"message": "Backend running"}
        return True
    except Exception as e:
        print(f"✗ Root route failed: {e}")
        return False

def test_health():
    """Test health endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✓ Health check: {response.status_code} - {response.json()}")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_login():
    """Test login endpoint."""
    try:
        response = requests.post(
            f"{BASE_URL}/login",
            json={"username": "student", "password": "student123"}
        )
        print(f"✓ Login: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "student"
        return True
    except Exception as e:
        print(f"✗ Login failed: {e}")
        return False

def test_emotions():
    """Test emotions endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/emotions")
        print(f"✓ Emotions: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert "counts" in data
        assert "student_wise" in data
        return True
    except Exception as e:
        print(f"✗ Emotions failed: {e}")
        return False

def test_quiz():
    """Test quiz generation endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/generate-quiz?student_id=1")
        print(f"✓ Quiz generation: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "difficulty" in data
        assert "questions" in data
        return True
    except Exception as e:
        print(f"✗ Quiz generation failed: {e}")
        return False

def main():
    """Run all tests."""
    print("Testing Flask Backend Endpoints\n")
    print(f"Base URL: {BASE_URL}\n")
    
    tests = [
        ("Root Route", test_root),
        ("Health Check", test_health),
        ("Login", test_login),
        ("Emotions", test_emotions),
        ("Quiz Generation", test_quiz),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\nTesting {name}...")
        results.append(test_func())
    
    print("\n" + "="*50)
    print(f"Results: {sum(results)}/{len(results)} tests passed")
    print("="*50)
    
    if all(results):
        print("\n✅ All tests passed! Backend is ready for deployment.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
