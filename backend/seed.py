"""
StockSense Seed Script
Run: python seed.py
Creates: 1 admin user, 5 categories, 3 suppliers, 20 products, 90 days of sales
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv
import os
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt(12)).decode()


async def seed():
    print("🌱 Starting StockSense seed...")

    # Check if already seeded
    if await db.users.find_one({"email": "admin@stocksense.com"}):
        print("✅ Database already seeded. Skipping.")
        return

    # ─── Users ───
    admin_id = str(uuid.uuid4())
    manager_id = str(uuid.uuid4())
    staff_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    await db.users.insert_many([
        {"_id": admin_id, "name": "Admin User", "email": "admin@stocksense.com",
         "password": hash_pw("Admin@123"), "role": "ADMIN", "created_at": now, "updated_at": now},
        {"_id": manager_id, "name": "Rahul Manager", "email": "manager@stocksense.com",
         "password": hash_pw("Manager@123"), "role": "MANAGER", "created_at": now, "updated_at": now},
        {"_id": staff_id, "name": "Priya Staff", "email": "staff@stocksense.com",
         "password": hash_pw("Staff@123"), "role": "STAFF", "created_at": now, "updated_at": now},
    ])
    print("  ✓ Users created")

    # ─── Categories ───
    cat_names = ["Electronics", "Groceries", "Clothing", "Stationery", "Home Appliances"]
    cat_ids = {}
    cats = []
    for name in cat_names:
        cid = str(uuid.uuid4())
        cat_ids[name] = cid
        cats.append({"_id": cid, "name": name,
                     "description": f"Products in the {name} category",
                     "created_at": now})
    await db.categories.insert_many(cats)
    print("  ✓ Categories created")

    # ─── Suppliers ───
    sup_data = [
        {"name": "Sharma Electronics Pvt Ltd", "email": "orders@sharmaelectronics.in",
         "phone": "+91-11-4567-8901", "address": "Nehru Place, New Delhi - 110019"},
        {"name": "Fresh Farm Produce Co.", "email": "supply@freshfarm.in",
         "phone": "+91-22-3456-7890", "address": "APMC Market, Navi Mumbai - 400705"},
        {"name": "National Retail Distributors", "email": "info@nationalretail.in",
         "phone": "+91-80-2345-6789", "address": "Whitefield, Bengaluru - 560066"},
    ]
    sup_ids = []
    sups = []
    for sd in sup_data:
        sid = str(uuid.uuid4())
        sup_ids.append(sid)
        sups.append({"_id": sid, **sd, "created_at": now})
    await db.suppliers.insert_many(sups)
    print("  ✓ Suppliers created")

    # ─── Products ───
    products_data = [
        # Electronics (sup_ids[0])
        {"name": "Samsung Smart TV 43\"", "sku": "ELC-TV43-001", "unit": "pcs",
         "cost_price": 28000, "selling_price": 34999, "current_stock": 15, "reorder_level": 5,
         "cat": "Electronics", "sup": 0, "daily_sales": 0.3},
        {"name": "iPhone 15 Silicone Case", "sku": "ELC-CASE-002", "unit": "pcs",
         "cost_price": 800, "selling_price": 1499, "current_stock": 45, "reorder_level": 15,
         "cat": "Electronics", "sup": 0, "daily_sales": 2.5},
        {"name": "Laptop Cooling Pad", "sku": "ELC-COOL-003", "unit": "pcs",
         "cost_price": 700, "selling_price": 1299, "current_stock": 28, "reorder_level": 10,
         "cat": "Electronics", "sup": 0, "daily_sales": 1.2},
        {"name": "Bluetooth Speaker JBL Clone", "sku": "ELC-SPK-004", "unit": "pcs",
         "cost_price": 1200, "selling_price": 2199, "current_stock": 8, "reorder_level": 12,
         "cat": "Electronics", "sup": 0, "daily_sales": 1.8},
        # Groceries (sup_ids[1])
        {"name": "Basmati Rice 5kg", "sku": "GRC-RICE-005", "unit": "kg",
         "cost_price": 280, "selling_price": 420, "current_stock": 120, "reorder_level": 40,
         "cat": "Groceries", "sup": 1, "daily_sales": 8},
        {"name": "Sunflower Cooking Oil 5L", "sku": "GRC-OIL-006", "unit": "litre",
         "cost_price": 580, "selling_price": 720, "current_stock": 0, "reorder_level": 30,
         "cat": "Groceries", "sup": 1, "daily_sales": 5},
        {"name": "Wheat Flour Atta 10kg", "sku": "GRC-ATTA-007", "unit": "kg",
         "cost_price": 350, "selling_price": 480, "current_stock": 65, "reorder_level": 25,
         "cat": "Groceries", "sup": 1, "daily_sales": 6},
        {"name": "Sugar Premium 1kg", "sku": "GRC-SUG-008", "unit": "kg",
         "cost_price": 42, "selling_price": 58, "current_stock": 200, "reorder_level": 50,
         "cat": "Groceries", "sup": 1, "daily_sales": 12},
        # Clothing (sup_ids[2])
        {"name": "Men's Formal Shirt (Assorted)", "sku": "CLT-SHRT-009", "unit": "pcs",
         "cost_price": 350, "selling_price": 699, "current_stock": 40, "reorder_level": 15,
         "cat": "Clothing", "sup": 2, "daily_sales": 2},
        {"name": "Women's Cotton Kurti", "sku": "CLT-KURT-010", "unit": "pcs",
         "cost_price": 280, "selling_price": 549, "current_stock": 55, "reorder_level": 20,
         "cat": "Clothing", "sup": 2, "daily_sales": 3},
        {"name": "Denim Jeans Slim Fit", "sku": "CLT-JEAN-011", "unit": "pcs",
         "cost_price": 600, "selling_price": 1199, "current_stock": 3, "reorder_level": 15,
         "cat": "Clothing", "sup": 2, "daily_sales": 1.5},
        {"name": "Casual Round Neck T-Shirt", "sku": "CLT-TSHRT-012", "unit": "pcs",
         "cost_price": 180, "selling_price": 349, "current_stock": 80, "reorder_level": 25,
         "cat": "Clothing", "sup": 2, "daily_sales": 4},
        # Stationery (sup_ids[2])
        {"name": "Ruled Notebook Pack of 6", "sku": "STN-NB-013", "unit": "pack",
         "cost_price": 90, "selling_price": 150, "current_stock": 100, "reorder_level": 30,
         "cat": "Stationery", "sup": 2, "daily_sales": 5},
        {"name": "Ballpoint Pens Pack of 12", "sku": "STN-PEN-014", "unit": "pack",
         "cost_price": 55, "selling_price": 95, "current_stock": 150, "reorder_level": 40,
         "cat": "Stationery", "sup": 2, "daily_sales": 7},
        {"name": "A4 Paper Ream 500 Sheets", "sku": "STN-PPR-015", "unit": "ream",
         "cost_price": 180, "selling_price": 280, "current_stock": 45, "reorder_level": 20,
         "cat": "Stationery", "sup": 2, "daily_sales": 3},
        {"name": "Sticky Notes 5-Pack", "sku": "STN-STK-016", "unit": "pack",
         "cost_price": 60, "selling_price": 110, "current_stock": 90, "reorder_level": 25,
         "cat": "Stationery", "sup": 2, "daily_sales": 4},
        # Home Appliances (sup_ids[2])
        {"name": "Electric Kettle 1.5L", "sku": "HME-KETL-017", "unit": "pcs",
         "cost_price": 580, "selling_price": 999, "current_stock": 20, "reorder_level": 8,
         "cat": "Home Appliances", "sup": 2, "daily_sales": 0.8},
        {"name": "Table Fan 400mm Sweep", "sku": "HME-FAN-018", "unit": "pcs",
         "cost_price": 1100, "selling_price": 1799, "current_stock": 6, "reorder_level": 8,
         "cat": "Home Appliances", "sup": 2, "daily_sales": 1.2},
        {"name": "Room Heater 2000W", "sku": "HME-HEAT-019", "unit": "pcs",
         "cost_price": 1800, "selling_price": 2999, "current_stock": 12, "reorder_level": 5,
         "cat": "Home Appliances", "sup": 2, "daily_sales": 0.6},
        {"name": "Mixer Grinder 750W 3-Jar", "sku": "HME-MXGR-020", "unit": "pcs",
         "cost_price": 2200, "selling_price": 3499, "current_stock": 10, "reorder_level": 5,
         "cat": "Home Appliances", "sup": 2, "daily_sales": 0.5},
    ]

    product_ids = []
    products_to_insert = []
    for pd in products_data:
        pid = str(uuid.uuid4())
        product_ids.append((pid, pd["daily_sales"], pd["selling_price"], pd["reorder_level"]))
        products_to_insert.append({
            "_id": pid, "name": pd["name"], "sku": pd["sku"],
            "description": f"High quality {pd['name']} for everyday use.",
            "image_url": None, "unit": pd["unit"],
            "cost_price": pd["cost_price"], "selling_price": pd["selling_price"],
            "current_stock": pd["current_stock"], "reorder_level": pd["reorder_level"],
            "category_id": cat_ids[pd["cat"]], "supplier_id": sup_ids[pd["sup"]],
            "created_at": now, "updated_at": now
        })
    await db.products.insert_many(products_to_insert)
    print("  ✓ Products created")

    # ─── Sales Records (90 days) ───
    sales_docs = []
    movement_docs = []
    today = datetime.now(timezone.utc).date()
    day_mult = [0.75, 0.85, 0.95, 1.0, 1.1, 1.35, 1.25]  # Mon-Sun

    for pid, base_daily, sell_price, reorder in product_ids:
        for i in range(90, 0, -1):
            sale_date = today - timedelta(days=i)
            dow = sale_date.weekday()
            trend = 1.0 + (90 - i) * 0.0015
            variation = random.uniform(0.6, 1.4)
            qty = max(0, round(base_daily * day_mult[dow] * trend * variation))
            if qty > 0:
                sid = str(uuid.uuid4())
                sd = sale_date.isoformat()
                sales_docs.append({
                    "_id": sid, "product_id": pid, "quantity_sold": qty,
                    "sale_date": sd, "total_amount": qty * float(sell_price),
                    "created_at": now
                })
                movement_docs.append({
                    "_id": str(uuid.uuid4()), "product_id": pid, "type": "OUT",
                    "quantity": qty, "reason": "Sale", "moved_at": sd, "created_at": now
                })

    # Batch insert
    batch = 500
    for i in range(0, len(sales_docs), batch):
        await db.sale_records.insert_many(sales_docs[i:i+batch])
    for i in range(0, len(movement_docs), batch):
        await db.stock_movements.insert_many(movement_docs[i:i+batch])
    print(f"  ✓ {len(sales_docs)} sales records created")

    # ─── Create alerts for low/out-of-stock products ───
    alert_docs = []
    for p in products_to_insert:
        if p["current_stock"] == 0:
            alert_docs.append({"_id": str(uuid.uuid4()), "product_id": p["_id"],
                               "type": "OUT_OF_STOCK",
                               "message": f"{p['name']} is out of stock",
                               "is_read": False, "is_resolved": False, "created_at": now})
        elif p["current_stock"] <= p["reorder_level"]:
            alert_docs.append({"_id": str(uuid.uuid4()), "product_id": p["_id"],
                               "type": "LOW_STOCK",
                               "message": f"{p['name']} is running low (Stock: {p['current_stock']}, Reorder: {p['reorder_level']})",
                               "is_read": False, "is_resolved": False, "created_at": now})
    if alert_docs:
        await db.alerts.insert_many(alert_docs)
        print(f"  ✓ {len(alert_docs)} alerts created")

    # ─── Create indexes ───
    await db.users.create_index("email", unique=True)
    await db.products.create_index("sku", unique=True)
    await db.sale_records.create_index([("product_id", 1), ("sale_date", 1)])
    await db.alerts.create_index([("product_id", 1), ("type", 1), ("is_resolved", 1)])

    print("\n✅ Seed complete!")
    print("   Admin: admin@stocksense.com / Admin@123")
    print("   Manager: manager@stocksense.com / Manager@123")
    print("   Staff: staff@stocksense.com / Staff@123")


if __name__ == "__main__":
    asyncio.run(seed())
    client.close()
