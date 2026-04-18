from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from pathlib import Path
from dotenv import load_dotenv
import jwt
import bcrypt
import os
import uuid
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_ACCESS_SECRET = os.environ.get("JWT_ACCESS_SECRET", "stocksense_access_secret_key_minimum_64_characters_abcdefghijklmno")
JWT_REFRESH_SECRET = os.environ.get("JWT_REFRESH_SECRET", "stocksense_refresh_secret_key_minimum_64_characters_abcdefghijklmno")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="StockSense API")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────── HELPERS ───────────────────────────

def doc(d):
    if d is None:
        return None
    d["id"] = str(d.pop("_id", ""))
    return d

def ok(data=None, message="Success", pagination=None):
    r = {"success": True, "message": message, "data": data}
    if pagination:
        r["pagination"] = pagination
    return r

def err(msg, code=400):
    raise HTTPException(status_code=code, detail=msg)

# ─────────────────────────── AUTH UTILS ───────────────────────────

def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt(12)).decode()

def check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())

def make_access(uid: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=60)
    return jwt.encode({"sub": uid, "role": role, "exp": exp, "type": "access"}, JWT_ACCESS_SECRET, algorithm="HS256")

def make_refresh(uid: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": uid, "exp": exp, "type": "refresh"}, JWT_REFRESH_SECRET, algorithm="HS256")

async def auth(request: Request):
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid token")
    token = h[7:]
    try:
        payload = jwt.decode(token, JWT_ACCESS_SECRET, algorithms=["HS256"])
        uid = payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def roles(*allowed):
    async def guard(user=Depends(auth)):
        if user.get("role") not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return guard

# ─────────────────────────── PREDICTION ENGINE ───────────────────────────

def flat_forecast(base: float):
    today = datetime.now(timezone.utc).date()
    return [{"date": (today + timedelta(days=i+1)).isoformat(), "predicted_qty": max(0, int(base))} for i in range(30)]

def run_prediction(records: list, current_stock: int) -> dict:
    if not records:
        return {"forecast_array": flat_forecast(1), "total_predicted_demand": 30,
                "average_daily_demand": 1.0, "confidence_score": 0.05,
                "days_until_stockout": current_stock, "restock_recommended": current_stock < 30}
    daily = defaultdict(float)
    for r in records:
        sd = r.get("sale_date", "")
        ds = sd.strftime("%Y-%m-%d") if hasattr(sd, "strftime") else str(sd)[:10]
        daily[ds] += float(r.get("quantity_sold", 0))
    dates = sorted(daily.keys())
    start = datetime.fromisoformat(dates[0])
    end = datetime.fromisoformat(dates[-1])
    all_d, cur = [], start
    while cur <= end:
        all_d.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    filled = [float(daily.get(d, 0)) for d in all_d]
    rolling = [sum(filled[max(0, i-6):i+1]) / len(filled[max(0, i-6):i+1]) for i in range(len(filled))]
    alpha = 0.3
    sm = [rolling[0]]
    for i in range(1, len(rolling)):
        sm.append(alpha * rolling[i] + (1 - alpha) * sm[-1])
    baseline = sm[-1] if sm else 1.0
    dow_totals = defaultdict(list)
    for i, d in enumerate(all_d):
        try:
            dow_totals[datetime.fromisoformat(d).weekday()].append(filled[i])
        except Exception:
            pass
    avg_dow = {k: sum(v)/len(v) for k, v in dow_totals.items() if v}
    overall = sum(avg_dow.values()) / len(avg_dow) if avg_dow else 1.0
    seas = {d: (avg_dow.get(d, overall) / overall if overall > 0 else 1.0) for d in range(7)}
    today = datetime.now(timezone.utc).date()
    forecast, total = [], 0
    for i in range(30):
        fd = today + timedelta(days=i+1)
        qty = max(0, round(baseline * seas.get(fd.weekday(), 1.0)))
        forecast.append({"date": fd.isoformat(), "predicted_qty": qty})
        total += qty
    avg_d = sum(filled) / len(filled) if filled else 0
    conf = min(1.0, len([x for x in filled if x > 0]) / 60.0)
    days_out = int(current_stock / avg_d) if avg_d > 0 else 999
    return {"forecast_array": forecast, "total_predicted_demand": total,
            "average_daily_demand": round(avg_d, 2), "confidence_score": round(conf, 2),
            "days_until_stockout": min(days_out, 999), "restock_recommended": days_out < 30 or current_stock <= 0}

# ─────────────────────────── ALERT HELPER ───────────────────────────

async def check_alert(product_id: str, stock: int, reorder: int, name: str):
    if stock <= 0:
        atype, msg = "OUT_OF_STOCK", f"{name} is out of stock"
    elif stock <= reorder:
        atype, msg = "LOW_STOCK", f"{name} is running low (Stock: {stock}, Reorder level: {reorder})"
    else:
        return
    existing = await db.alerts.find_one({"product_id": product_id, "type": atype, "is_resolved": False})
    if not existing:
        await db.alerts.insert_one({"_id": str(uuid.uuid4()), "product_id": product_id,
                                    "type": atype, "message": msg, "is_read": False,
                                    "is_resolved": False, "created_at": datetime.now(timezone.utc).isoformat()})

# ─────────────────────────── MODELS ───────────────────────────

class RegisterIn(BaseModel):
    name: str; email: str; password: str; role: str = "STAFF"

class LoginIn(BaseModel):
    email: str; password: str

class CategoryIn(BaseModel):
    name: str; description: Optional[str] = None

class SupplierIn(BaseModel):
    name: str; email: str; phone: str; address: str

class ProductIn(BaseModel):
    name: str; sku: Optional[str] = None; description: Optional[str] = None
    image_url: Optional[str] = None; unit: str = "pcs"
    cost_price: float; selling_price: float; current_stock: int
    reorder_level: int; category_id: str; supplier_id: str

class ProductUpd(BaseModel):
    name: Optional[str] = None; description: Optional[str] = None
    image_url: Optional[str] = None; unit: Optional[str] = None
    cost_price: Optional[float] = None; selling_price: Optional[float] = None
    reorder_level: Optional[int] = None; category_id: Optional[str] = None; supplier_id: Optional[str] = None

class StockIn(BaseModel):
    quantity: int; reason: str = "Audit Correction"; note: Optional[str] = None

class SaleIn(BaseModel):
    product_id: str; quantity_sold: int; sale_date: Optional[str] = None

class AlertNote(BaseModel):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None; email: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str; new_password: str

class GoogleAuthIn(BaseModel):
    credential: str

class GoogleCodeIn(BaseModel):
    code: str
    redirect_uri: str

# ─────────────────────────── AUTH ROUTER ───────────────────────────

auth_r = APIRouter(prefix="/api/auth", tags=["auth"])

@auth_r.post("/register")
async def register(data: RegisterIn, response: Response):
    if await db.users.find_one({"email": data.email}):
        err("Email already registered", 409)
    role = data.role.upper() if data.role.upper() in ["ADMIN", "MANAGER", "STAFF"] else "STAFF"
    uid = str(uuid.uuid4())
    await db.users.insert_one({"_id": uid, "name": data.name, "email": data.email,
                                "password": hash_pw(data.password), "role": role,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat()})
    at = make_access(uid, role)
    rt = make_refresh(uid)
    response.set_cookie("refresh_token", rt, httponly=True, max_age=7*86400, samesite="lax")
    return ok({"access_token": at, "user": {"id": uid, "name": data.name, "email": data.email, "role": role}}, "Registration successful")

@auth_r.post("/login")
async def login(data: LoginIn, response: Response):
    u = await db.users.find_one({"email": data.email})
    if not u or not check_pw(data.password, u["password"]):
        err("Invalid email or password", 401)
    uid = u["_id"]
    at = make_access(uid, u["role"])
    rt = make_refresh(uid)
    response.set_cookie("refresh_token", rt, httponly=True, max_age=7*86400, samesite="lax")
    return ok({"access_token": at, "user": {"id": uid, "name": u["name"], "email": u["email"], "role": u["role"]}}, "Login successful")

@auth_r.post("/refresh")
async def refresh(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        err("Refresh token missing", 401)
    try:
        payload = jwt.decode(rt, JWT_REFRESH_SECRET, algorithms=["HS256"])
        uid = payload.get("sub")
    except Exception:
        err("Invalid refresh token", 401)
    u = await db.users.find_one({"_id": uid})
    if not u:
        err("User not found", 401)
    return ok({"access_token": make_access(uid, u["role"])}, "Token refreshed")

@auth_r.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return ok(None, "Logged out")

@auth_r.post("/google")
async def google_auth(data: GoogleAuthIn, response: Response):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    try:
        idinfo = id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        err(f"Invalid Google token: {str(e)}", 401)

    email = idinfo.get("email", "")
    name = idinfo.get("name", email)
    picture = idinfo.get("picture", "")

    u = await db.users.find_one({"email": email})
    if u:
        uid = u["_id"]
        role = u["role"]
        await db.users.update_one({"_id": uid}, {"$set": {"picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        uid = str(uuid.uuid4())
        role = "STAFF"
        await db.users.insert_one({
            "_id": uid, "name": name, "email": email,
            "password": "", "role": role, "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    at = make_access(uid, role)
    rt = make_refresh(uid)
    response.set_cookie("refresh_token", rt, httponly=True, max_age=7*86400, samesite="lax")
    return ok({"access_token": at, "user": {"id": uid, "name": name, "email": email, "role": role, "picture": picture}}, "Google login successful")

@auth_r.post("/google/callback")
async def google_callback(data: GoogleCodeIn, response: Response):
    import httpx
    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": data.code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": data.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    tokens = token_res.json()
    if "error" in tokens:
        err(f"Token exchange failed: {tokens.get('error_description', tokens['error'])}", 401)

    # Get user info using the access token
    async with httpx.AsyncClient() as client:
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
    userinfo = userinfo_res.json()

    email = userinfo.get("email", "")
    name = userinfo.get("name", email)
    picture = userinfo.get("picture", "")

    u = await db.users.find_one({"email": email})
    if u:
        uid = u["_id"]
        role = u["role"]
        await db.users.update_one({"_id": uid}, {"$set": {"picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        uid = str(uuid.uuid4())
        role = "STAFF"
        await db.users.insert_one({
            "_id": uid, "name": name, "email": email,
            "password": "", "role": role, "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    at = make_access(uid, role)
    rt = make_refresh(uid)
    response.set_cookie("refresh_token", rt, httponly=True, max_age=7*86400, samesite="lax")
    return ok({"access_token": at, "user": {"id": uid, "name": name, "email": email, "role": role, "picture": picture}}, "Google login successful")

@auth_r.get("/me")
async def me(user=Depends(auth)):
    return ok({"id": user["_id"], "name": user["name"], "email": user["email"],
               "role": user["role"], "created_at": user.get("created_at")})

# ─────────────────────────── CATEGORIES ───────────────────────────

cat_r = APIRouter(prefix="/api/categories", tags=["categories"])

@cat_r.get("")
async def list_cats(user=Depends(auth)):
    cats = await db.categories.find({}).to_list(1000)
    result = []
    for c in cats:
        cnt = await db.products.count_documents({"category_id": c["_id"]})
        result.append({"id": c["_id"], "name": c["name"], "description": c.get("description"),
                       "product_count": cnt, "created_at": c.get("created_at")})
    return ok(result)

@cat_r.post("")
async def create_cat(data: CategoryIn, user=Depends(roles("ADMIN", "MANAGER"))):
    if await db.categories.find_one({"name": data.name}):
        err("Category already exists", 409)
    cid = str(uuid.uuid4())
    d = {"_id": cid, "name": data.name, "description": data.description,
         "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categories.insert_one(d)
    return ok({"id": cid, "name": data.name, "description": data.description}, "Category created")

@cat_r.put("/{cid}")
async def update_cat(cid: str, data: CategoryIn, user=Depends(roles("ADMIN", "MANAGER"))):
    r = await db.categories.update_one({"_id": cid}, {"$set": {"name": data.name, "description": data.description}})
    if r.matched_count == 0:
        err("Category not found", 404)
    return ok({"id": cid, "name": data.name, "description": data.description})

@cat_r.delete("/{cid}")
async def delete_cat(cid: str, user=Depends(roles("ADMIN"))):
    cnt = await db.products.count_documents({"category_id": cid})
    if cnt > 0:
        err(f"Cannot delete: {cnt} product(s) linked to this category")
    r = await db.categories.delete_one({"_id": cid})
    if r.deleted_count == 0:
        err("Category not found", 404)
    return ok(None, "Category deleted")

# ─────────────────────────── SUPPLIERS ───────────────────────────

sup_r = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

@sup_r.get("")
async def list_sups(user=Depends(auth)):
    sups = await db.suppliers.find({}).to_list(1000)
    result = []
    for s in sups:
        cnt = await db.products.count_documents({"supplier_id": s["_id"]})
        result.append({"id": s["_id"], "name": s["name"], "email": s["email"],
                       "phone": s["phone"], "address": s["address"],
                       "product_count": cnt, "created_at": s.get("created_at")})
    return ok(result)

@sup_r.post("")
async def create_sup(data: SupplierIn, user=Depends(roles("ADMIN", "MANAGER"))):
    sid = str(uuid.uuid4())
    await db.suppliers.insert_one({"_id": sid, "name": data.name, "email": data.email,
                                   "phone": data.phone, "address": data.address,
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    return ok({"id": sid, "name": data.name, "email": data.email, "phone": data.phone, "address": data.address}, "Supplier created")

@sup_r.put("/{sid}")
async def update_sup(sid: str, data: SupplierIn, user=Depends(roles("ADMIN", "MANAGER"))):
    r = await db.suppliers.update_one({"_id": sid}, {"$set": {"name": data.name, "email": data.email,
                                                               "phone": data.phone, "address": data.address}})
    if r.matched_count == 0:
        err("Supplier not found", 404)
    return ok({"id": sid, "name": data.name, "email": data.email, "phone": data.phone, "address": data.address})

@sup_r.delete("/{sid}")
async def delete_sup(sid: str, user=Depends(roles("ADMIN"))):
    r = await db.suppliers.delete_one({"_id": sid})
    if r.deleted_count == 0:
        err("Supplier not found", 404)
    return ok(None, "Supplier deleted")

# ─────────────────────────── PRODUCTS ───────────────────────────

prod_r = APIRouter(prefix="/api/products", tags=["products"])

async def enrich_product(p: dict) -> dict:
    cat = await db.categories.find_one({"_id": p.get("category_id")})
    sup = await db.suppliers.find_one({"_id": p.get("supplier_id")})
    s = p.get("current_stock", 0)
    rl = p.get("reorder_level", 0)
    status = "out_of_stock" if s == 0 else ("low_stock" if s <= rl else "in_stock")
    return {"id": p["_id"], "name": p["name"], "sku": p.get("sku", ""),
            "description": p.get("description"), "image_url": p.get("image_url"),
            "unit": p.get("unit", "pcs"), "cost_price": p.get("cost_price", 0),
            "selling_price": p.get("selling_price", 0), "current_stock": s,
            "reorder_level": rl, "stock_status": status,
            "category_id": p.get("category_id"), "category_name": cat["name"] if cat else "Unknown",
            "supplier_id": p.get("supplier_id"), "supplier_name": sup["name"] if sup else "Unknown",
            "created_at": p.get("created_at"), "updated_at": p.get("updated_at")}

@prod_r.get("")
async def list_products(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=200),
                        search: Optional[str] = None, category_id: Optional[str] = None,
                        stock_status: Optional[str] = None, user=Depends(auth)):
    q = {}
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"sku": {"$regex": search, "$options": "i"}}]
    if category_id:
        q["category_id"] = category_id
    if stock_status == "out_of_stock":
        q["current_stock"] = 0
    elif stock_status == "low_stock":
        q["$expr"] = {"$and": [{"$gt": ["$current_stock", 0]}, {"$lte": ["$current_stock", "$reorder_level"]}]}
    elif stock_status == "in_stock":
        q["$expr"] = {"$gt": ["$current_stock", "$reorder_level"]}
    total = await db.products.count_documents(q)
    prods = await db.products.find(q).skip((page-1)*limit).limit(limit).to_list(limit)
    result = [await enrich_product(p) for p in prods]
    return ok(result, "Products retrieved", {"page": page, "limit": limit, "total": total, "totalPages": (total+limit-1)//limit})

@prod_r.get("/{pid}")
async def get_product(pid: str, user=Depends(auth)):
    p = await db.products.find_one({"_id": pid})
    if not p:
        err("Product not found", 404)
    enriched = await enrich_product(p)
    movements = await db.stock_movements.find({"product_id": pid}).sort("created_at", -1).limit(10).to_list(10)
    enriched["recent_movements"] = [doc(m) for m in movements]
    return ok(enriched)

@prod_r.post("")
async def create_product(data: ProductIn, user=Depends(roles("ADMIN", "MANAGER"))):
    pid = str(uuid.uuid4())
    sku = data.sku or f"SKU-{data.category_id[:4].upper()}-{int(datetime.now().timestamp())}"
    if await db.products.find_one({"sku": sku}):
        sku = f"{sku}-{pid[:4]}"
    now = datetime.now(timezone.utc).isoformat()
    pdoc = {"_id": pid, "name": data.name, "sku": sku, "description": data.description,
            "image_url": data.image_url, "unit": data.unit, "cost_price": data.cost_price,
            "selling_price": data.selling_price, "current_stock": data.current_stock,
            "reorder_level": data.reorder_level, "category_id": data.category_id,
            "supplier_id": data.supplier_id, "created_at": now, "updated_at": now}
    await db.products.insert_one(pdoc)
    await check_alert(pid, data.current_stock, data.reorder_level, data.name)
    return ok(await enrich_product(pdoc), "Product created")

@prod_r.put("/{pid}")
async def update_product(pid: str, data: ProductUpd, user=Depends(roles("ADMIN", "MANAGER"))):
    p = await db.products.find_one({"_id": pid})
    if not p:
        err("Product not found", 404)
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"_id": pid}, {"$set": upd})
    updated = await db.products.find_one({"_id": pid})
    return ok(await enrich_product(updated))

@prod_r.delete("/{pid}")
async def delete_product(pid: str, user=Depends(roles("ADMIN"))):
    r = await db.products.delete_one({"_id": pid})
    if r.deleted_count == 0:
        err("Product not found", 404)
    return ok(None, "Product deleted")

@prod_r.patch("/{pid}/stock")
async def update_stock(pid: str, data: StockIn, user=Depends(auth)):
    p = await db.products.find_one({"_id": pid})
    if not p:
        err("Product not found", 404)
    old_stock = p.get("current_stock", 0)
    delta = data.quantity - old_stock
    now = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"_id": pid}, {"$set": {"current_stock": data.quantity, "updated_at": now}})
    await db.stock_movements.insert_one({"_id": str(uuid.uuid4()), "product_id": pid,
                                          "type": "IN" if delta > 0 else "ADJUSTMENT",
                                          "quantity": abs(delta), "reason": data.reason,
                                          "note": data.note, "moved_at": now, "created_at": now})
    await check_alert(pid, data.quantity, p.get("reorder_level", 0), p["name"])
    # Resolve existing alert if stock is now healthy
    if data.quantity > p.get("reorder_level", 0):
        await db.alerts.update_many({"product_id": pid, "is_resolved": False},
                                    {"$set": {"is_resolved": True}})
    return ok({"current_stock": data.quantity, "previous_stock": old_stock}, "Stock updated")

# ─────────────────────────── SALES ───────────────────────────

sale_r = APIRouter(prefix="/api/sales", tags=["sales"])

@sale_r.get("/summary")
async def sales_summary(user=Depends(auth)):
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now.date() - timedelta(days=now.weekday())).isoformat()
    month_start = now.date().replace(day=1).isoformat()

    async def revenue_in(start_date: str):
        sales = await db.sale_records.find({"sale_date": {"$gte": start_date}}).to_list(100000)
        return sum(s.get("total_amount", 0) for s in sales), sum(s.get("quantity_sold", 0) for s in sales)

    today_rev, today_units = await revenue_in(today)
    week_rev, week_units = await revenue_in(week_start)
    month_rev, month_units = await revenue_in(month_start)

    total_products = await db.products.count_documents({})
    low_stock = await db.products.count_documents({"$expr": {"$and": [{"$gt": ["$current_stock", 0]}, {"$lte": ["$current_stock", "$reorder_level"]}]}})
    out_of_stock = await db.products.count_documents({"current_stock": 0})

    pipeline = [{"$match": {"sale_date": {"$gte": month_start}}},
                {"$group": {"_id": "$product_id", "total": {"$sum": "$quantity_sold"}}},
                {"$sort": {"total": -1}}, {"$limit": 1}]
    top = await db.sale_records.aggregate(pipeline).to_list(1)
    best_product = None
    if top:
        bp = await db.products.find_one({"_id": top[0]["_id"]})
        best_product = {"name": bp["name"] if bp else "Unknown", "units_sold": top[0]["total"]}

    return ok({"today_revenue": today_rev, "today_units": today_units,
               "week_revenue": week_rev, "week_units": week_units,
               "month_revenue": month_rev, "month_units": month_units,
               "total_products": total_products, "low_stock_count": low_stock,
               "out_of_stock_count": out_of_stock, "best_product": best_product})

@sale_r.get("/by-product/{pid}")
async def sales_by_product(pid: str, user=Depends(auth)):
    sales = await db.sale_records.find({"product_id": pid}).sort("sale_date", 1).to_list(100000)
    return ok([doc(s) for s in sales])

@sale_r.post("")
async def record_sale(data: SaleIn, user=Depends(auth)):
    p = await db.products.find_one({"_id": data.product_id})
    if not p:
        err("Product not found", 404)
    if p["current_stock"] < data.quantity_sold:
        err(f"Insufficient stock. Available: {p['current_stock']}")
    sale_date = data.sale_date or datetime.now(timezone.utc).date().isoformat()
    total = float(p.get("selling_price", 0)) * data.quantity_sold
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    sdoc = {"_id": sid, "product_id": data.product_id, "quantity_sold": data.quantity_sold,
            "sale_date": sale_date, "total_amount": total, "product_name": p["name"],
            "recorded_by": user["_id"], "created_at": now}
    await db.sale_records.insert_one(sdoc)
    new_stock = p["current_stock"] - data.quantity_sold
    await db.products.update_one({"_id": data.product_id}, {"$set": {"current_stock": new_stock, "updated_at": now}})
    await db.stock_movements.insert_one({"_id": str(uuid.uuid4()), "product_id": data.product_id,
                                          "type": "OUT", "quantity": data.quantity_sold,
                                          "reason": "Sale recorded", "moved_at": now, "created_at": now})
    await check_alert(data.product_id, new_stock, p.get("reorder_level", 0), p["name"])
    sdoc["id"] = sid
    del sdoc["_id"]
    return ok(sdoc, "Sale recorded")

@sale_r.get("")
async def list_sales(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=5000),
                     product_id: Optional[str] = None, start_date: Optional[str] = None,
                     end_date: Optional[str] = None, user=Depends(auth)):
    q = {}
    if product_id:
        q["product_id"] = product_id
    if start_date or end_date:
        q["sale_date"] = {}
        if start_date:
            q["sale_date"]["$gte"] = start_date
        if end_date:
            q["sale_date"]["$lte"] = end_date
    total = await db.sale_records.count_documents(q)
    sales = await db.sale_records.find(q).sort("sale_date", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    result = []
    for s in sales:
        p = await db.products.find_one({"_id": s.get("product_id")})
        cat = await db.categories.find_one({"_id": p.get("category_id")}) if p else None
        result.append({"id": s["_id"], "product_id": s.get("product_id"),
                       "product_name": p["name"] if p else s.get("product_name", "Unknown"),
                       "category_name": cat["name"] if cat else "Unknown",
                       "quantity_sold": s.get("quantity_sold"), "sale_date": s.get("sale_date"),
                       "total_amount": s.get("total_amount"), "created_at": s.get("created_at")})
    return ok(result, "Sales retrieved", {"page": page, "limit": limit, "total": total, "totalPages": (total+limit-1)//limit})

# ─────────────────────────── ALERTS ───────────────────────────

alert_r = APIRouter(prefix="/api/alerts", tags=["alerts"])

@alert_r.get("")
async def list_alerts(type: Optional[str] = None, user=Depends(auth)):
    q = {"is_resolved": False}
    if type in ["LOW_STOCK", "OUT_OF_STOCK"]:
        q["type"] = type
    alerts = await db.alerts.find(q).sort("created_at", -1).to_list(1000)
    result = []
    for a in alerts:
        p = await db.products.find_one({"_id": a.get("product_id")})
        result.append({"id": a["_id"], "product_id": a.get("product_id"),
                       "product_name": p["name"] if p else "Unknown",
                       "product_sku": p.get("sku", "") if p else "",
                       "product_image": p.get("image_url") if p else None,
                       "current_stock": p.get("current_stock", 0) if p else 0,
                       "reorder_level": p.get("reorder_level", 0) if p else 0,
                       "type": a.get("type"), "message": a.get("message"),
                       "is_read": a.get("is_read", False), "is_resolved": a.get("is_resolved", False),
                       "created_at": a.get("created_at")})
    return ok(result)

@alert_r.patch("/{aid}/read")
async def mark_read(aid: str, user=Depends(auth)):
    await db.alerts.update_one({"_id": aid}, {"$set": {"is_read": True}})
    return ok(None, "Alert marked as read")

@alert_r.patch("/{aid}/resolve")
async def resolve_alert(aid: str, user=Depends(auth)):
    await db.alerts.update_one({"_id": aid}, {"$set": {"is_resolved": True, "is_read": True}})
    return ok(None, "Alert resolved")

@alert_r.delete("/{aid}")
async def delete_alert(aid: str, user=Depends(roles("ADMIN"))):
    r = await db.alerts.delete_one({"_id": aid})
    if r.deleted_count == 0:
        err("Alert not found", 404)
    return ok(None, "Alert deleted")

# ─────────────────────────── PREDICTIONS ───────────────────────────

pred_r = APIRouter(prefix="/api/predictions", tags=["predictions"])

@pred_r.get("/insights")
async def ai_insights(user=Depends(auth)):
    products = await db.products.find({}).to_list(1000)
    low = [p for p in products if p.get("current_stock", 0) <= p.get("reorder_level", 0) and p.get("current_stock", 0) > 0]
    out = [p for p in products if p.get("current_stock", 0) == 0]
    m30 = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    recent = await db.sale_records.find({"sale_date": {"$gte": m30}}).to_list(100000)
    rev = sum(s.get("total_amount", 0) for s in recent)

    summary = f"""Inventory Analytics Summary:
- Total Products: {len(products)}
- Low Stock Products ({len(low)}): {', '.join(p['name'] for p in low[:5])}
- Out of Stock ({len(out)}): {', '.join(p['name'] for p in out[:3])}
- Sales Last 30 Days: {len(recent)} transactions, Revenue: INR {rev:,.0f}
- Top categories by product count: Electronics, Groceries, Clothing"""

    if EMERGENT_LLM_KEY:
        try:
            import json
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=EMERGENT_LLM_KEY)
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a business intelligence analyst for an inventory management system. Always respond with valid JSON only."},
                    {"role": "user", "content": f"""Based on this inventory data, provide exactly 5 actionable business insights as a JSON array.
{summary}
Return ONLY a valid JSON array. Each item must have: "title" (string), "description" (2-3 sentences), "severity" ("info"|"warning"|"critical"), "affectedProduct" (string).
"""}
                ],
                temperature=0.7,
            )
            resp = response.choices[0].message.content or ""
            clean = resp.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            insights = json.loads(clean)
            if isinstance(insights, list) and len(insights) >= 1:
                return ok(insights[:5], "AI insights generated")
        except Exception as e:
            logger.error(f"AI insights error: {e}")

    fallback = [
        {"title": "Monitor Low Stock Items", "description": f"{len(low)} products are below reorder level. Place orders immediately to avoid stockouts.", "severity": "warning" if low else "info", "affectedProduct": low[0]["name"] if low else "Multiple Products"},
        {"title": "Out of Stock Alert", "description": f"{len(out)} products are completely out of stock. Immediate restocking required to prevent revenue loss.", "severity": "critical" if out else "info", "affectedProduct": out[0]["name"] if out else "All Products"},
        {"title": "Sales Performance", "description": f"Recorded {len(recent)} sales in the last 30 days generating INR {rev:,.0f} in revenue. Review top-performing products.", "severity": "info", "affectedProduct": "Multiple Products"},
        {"title": "Reorder Planning", "description": "Review reorder levels for fast-moving products. Ensure safety stock is maintained for peak demand periods.", "severity": "info", "affectedProduct": "Multiple Products"},
        {"title": "Inventory Optimization", "description": "Run a quarterly audit to identify slow-moving stock. Consider promotions or discounts to clear aging inventory.", "severity": "info", "affectedProduct": "All Products"},
    ]
    return ok(fallback, "Insights generated")

@pred_r.get("")
async def all_predictions(user=Depends(auth)):
    products = await db.products.find({}).to_list(1000)
    result = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for p in products:
        pid = p["_id"]
        cache = await db.prediction_cache.find_one({"product_id": pid})
        if cache and cache.get("expires_at", "") > now_iso:
            result.append({"product_id": pid, "product_name": p["name"],
                           "product_image": p.get("image_url"), "current_stock": p["current_stock"],
                           "selling_price": p.get("selling_price", 0),
                           "total_predicted_demand": cache.get("predicted_demand", 0),
                           "predicted_demand": cache.get("predicted_demand", 0),
                           "confidence_score": cache.get("confidence_score", 0),
                           "days_until_stockout": cache.get("days_until_stockout", 999),
                           "average_daily_demand": cache.get("average_daily_demand", 0),
                           "restock_recommended": cache.get("restock_recommended", False)})
        else:
            sales = await db.sale_records.find({"product_id": pid}).to_list(100000)
            pred = run_prediction(sales, p["current_stock"])
            exp = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            await db.prediction_cache.update_one({"product_id": pid},
                {"$set": {"product_id": pid, "predicted_demand": pred["total_predicted_demand"],
                          "confidence_score": pred["confidence_score"],
                          "average_daily_demand": pred["average_daily_demand"],
                          "days_until_stockout": pred["days_until_stockout"],
                          "restock_recommended": pred["restock_recommended"],
                          "prediction_period": "next_30_days",
                          "generated_at": datetime.now(timezone.utc).isoformat(),
                          "expires_at": exp}}, upsert=True)
            result.append({"product_id": pid, "product_name": p["name"],
                           "product_image": p.get("image_url"), "current_stock": p["current_stock"],
                           "selling_price": p.get("selling_price", 0), **pred})
    return ok(result)

@pred_r.get("/{pid}")
async def product_prediction(pid: str, user=Depends(auth)):
    p = await db.products.find_one({"_id": pid})
    if not p:
        err("Product not found", 404)
    sales = await db.sale_records.find({"product_id": pid}).sort("sale_date", 1).to_list(100000)
    pred = run_prediction(sales, p["current_stock"])
    return ok({"product_id": pid, "product_name": p["name"],
               "current_stock": p["current_stock"], "selling_price": p.get("selling_price", 0),
               "reorder_level": p.get("reorder_level", 0), **pred})

# ─────────────────────────── USER SETTINGS ───────────────────────────

users_r = APIRouter(prefix="/api/users", tags=["users"])

@users_r.get("")
async def list_users(user=Depends(roles("ADMIN"))):
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    return ok([{"id": u["_id"], "name": u["name"], "email": u["email"],
                "role": u["role"], "created_at": u.get("created_at")} for u in users])

@users_r.put("/profile")
async def update_profile(data: UserUpdate, user=Depends(auth)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
    updated = await db.users.find_one({"_id": user["_id"]})
    return ok({"id": updated["_id"], "name": updated["name"], "email": updated["email"], "role": updated["role"]})

@users_r.put("/password")
async def change_password(data: PasswordChange, user=Depends(auth)):
    if not check_pw(data.current_password, user["password"]):
        err("Current password is incorrect", 400)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password": hash_pw(data.new_password)}})
    return ok(None, "Password changed successfully")

@users_r.patch("/{uid}/role")
async def change_role(uid: str, request: Request, user=Depends(roles("ADMIN"))):
    body = await request.json()
    role = body.get("role", "").upper()
    if role not in ["ADMIN", "MANAGER", "STAFF"]:
        err("Invalid role")
    await db.users.update_one({"_id": uid}, {"$set": {"role": role}})
    return ok(None, "Role updated")

# ─────────────────────────── APP SETUP ───────────────────────────

for router in [auth_r, cat_r, sup_r, prod_r, sale_r, alert_r, pred_r, users_r]:
    app.include_router(router)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.get("/api/")
async def root():
    return {"message": "StockSense API", "status": "running"}

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
