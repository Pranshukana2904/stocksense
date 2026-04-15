"""StockSense API Tests - Full coverage of all endpoints"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@stocksense.com", "password": "Admin@123"})
    assert r.status_code == 200
    return r.json()["data"]["access_token"]

@pytest.fixture(scope="session")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── Auth ──────────────────────────────────────────────────────────
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@stocksense.com", "password": "Admin@123"})
        assert r.status_code == 200
        d = r.json()["data"]
        assert "access_token" in d
        assert d["user"]["role"] == "ADMIN"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@bad.com", "password": "wrong"})
        assert r.status_code in [400, 401]

    def test_me(self, headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["email"] == "admin@stocksense.com"

# ── Dashboard / Analytics ─────────────────────────────────────────
class TestDashboard:
    def test_kpi_via_sales_summary(self, headers):
        r = requests.get(f"{BASE_URL}/api/sales/summary", headers=headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert "total_products" in d

    def test_sales_forecast(self, headers):
        # Forecast is derived from product predictions
        r = requests.get(f"{BASE_URL}/api/predictions", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_ai_insights(self, headers):
        r = requests.get(f"{BASE_URL}/api/predictions/insights", headers=headers)
        assert r.status_code == 200

# ── Inventory / Products ──────────────────────────────────────────
class TestInventory:
    def test_list_products(self, headers):
        r = requests.get(f"{BASE_URL}/api/products", headers=headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d) >= 20

    def test_create_product(self, headers):
        # Need valid category_id and supplier_id
        cats = requests.get(f"{BASE_URL}/api/categories", headers=headers).json()["data"]
        sups = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()["data"]
        payload = {
            "name": "TEST_Product_Widget",
            "sku": "TEST-SKU-001",
            "category_id": cats[0]["id"],
            "supplier_id": sups[0]["id"],
            "cost_price": 10.0,
            "selling_price": 20.0,
            "current_stock": 50,
            "reorder_level": 10,
            "unit": "pcs"
        }
        r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["name"] == "TEST_Product_Widget"

    def test_update_product(self, headers):
        cats = requests.get(f"{BASE_URL}/api/categories", headers=headers).json()["data"]
        sups = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()["data"]
        payload = {"name": "TEST_UpdateProduct", "sku": "TEST-SKU-002", "cost_price": 5.0, "selling_price": 10.0, "current_stock": 20, "reorder_level": 5, "unit": "pcs", "category_id": cats[0]["id"], "supplier_id": sups[0]["id"]}
        create = requests.post(f"{BASE_URL}/api/products", json=payload, headers=headers)
        assert create.status_code == 200
        pid = create.json()["data"]["id"]
        update = requests.put(f"{BASE_URL}/api/products/{pid}", json={"selling_price": 15.0}, headers=headers)
        assert update.status_code == 200
        assert update.json()["data"]["selling_price"] == 15.0

    def test_stock_adjustment(self, headers):
        prods = requests.get(f"{BASE_URL}/api/products", headers=headers).json()["data"]
        pid = prods[0]["id"]
        r = requests.patch(f"{BASE_URL}/api/products/{pid}/stock", json={"quantity": 55, "reason": "Received Shipment"}, headers=headers)
        assert r.status_code == 200

# ── Alerts ───────────────────────────────────────────────────────
class TestAlerts:
    def test_list_alerts(self, headers):
        r = requests.get(f"{BASE_URL}/api/alerts", headers=headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d) >= 1

    def test_mark_read(self, headers):
        alerts = requests.get(f"{BASE_URL}/api/alerts", headers=headers).json()["data"]
        aid = alerts[0]["id"]
        r = requests.patch(f"{BASE_URL}/api/alerts/{aid}/read", headers=headers)
        assert r.status_code == 200

# ── Predictions ──────────────────────────────────────────────────
class TestPredictions:
    def test_list_predictions(self, headers):
        r = requests.get(f"{BASE_URL}/api/predictions", headers=headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d) >= 1
        assert "days_until_stockout" in d[0]

    def test_product_forecast(self, headers):
        prods = requests.get(f"{BASE_URL}/api/products", headers=headers).json()["data"]
        pid = prods[0]["id"]
        r = requests.get(f"{BASE_URL}/api/predictions/{pid}", headers=headers)
        assert r.status_code == 200

# ── Sales ────────────────────────────────────────────────────────
class TestSales:
    def test_list_sales(self, headers):
        r = requests.get(f"{BASE_URL}/api/sales", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_record_sale(self, headers):
        prods = requests.get(f"{BASE_URL}/api/products?search=Basmati", headers=headers).json()["data"]
        assert len(prods) >= 1
        pid = prods[0]["id"]
        r = requests.post(f"{BASE_URL}/api/sales", json={"product_id": pid, "quantity_sold": 2, "sale_date": "2026-02-13"}, headers=headers)
        assert r.status_code == 200

# ── Suppliers ────────────────────────────────────────────────────
class TestSuppliers:
    def test_list_suppliers(self, headers):
        r = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 3

    def test_create_supplier(self, headers):
        r = requests.post(f"{BASE_URL}/api/suppliers", json={"name": "TEST_Supplier", "email": "test_sup@test.com", "phone": "1234567890", "address": "Test City"}, headers=headers)
        assert r.status_code == 200

# ── Categories ───────────────────────────────────────────────────
class TestCategories:
    def test_list_categories(self, headers):
        r = requests.get(f"{BASE_URL}/api/categories", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 5
