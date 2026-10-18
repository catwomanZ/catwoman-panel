import time
import unittest
from pathlib import Path

from html.parser import HTMLParser

from jinja2 import Environment, FileSystemLoader, select_autoescape


class FormCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "form":
            self.current = {"action": attributes.get("action"), "names": []}
            self.forms.append(self.current)
        elif self.current is not None and tag in {"input", "select", "textarea"} and attributes.get("name"):
            self.current["names"].append(attributes["name"])

    def handle_endtag(self, tag):
        if tag == "form":
            self.current = None


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"


def user_fixture(status="active"):
    return {
        "id": "11111111-2222-3333-4444-555555555555",
        "username": "sample.user",
        "description": "Sample service",
        "data_limit": 50 * 1024**3,
        "data_used": 12 * 1024**3,
        "expiry_date": int(time.time()) + 30 * 86400,
        "protocol": "vless",
        "flow": "",
        "ip_limit": 2,
        "note": "",
        "telegram_id": "123456789",
        "status": status,
        "sub_token": "sample-token",
        "last_online": int(time.time()) - 10,
    }


def format_bytes(value):
    return f"{value / 1024**3:.2f} GB"


def render_context():
    user = user_fixture()
    stats = {"total_users": 1, "active_users": 1, "disabled_users": 0, "total_traffic": user["data_used"], "online_users": 1}
    server = {"cpu_percent": 12, "ram_percent": 34, "disk_percent": 45, "ram_used": 1, "ram_total": 2, "disk_used": 3, "disk_total": 4, "uptime": "1d 2h 3m"}
    return {
        "request": object(), "panel_name": "CatWoman", "active_page": "dashboard",
        "error": None, "success": None, "stats": stats, "xray_status": True,
        "server_info": server, "top_users": [user], "chart_labels": ["2026-10-18"],
        "chart_data": [12], "format_bytes": format_bytes, "users": [user],
        "online_users": [user], "online_count": 1,
        "days_remaining": lambda _: "30", "time_ago": lambda _: "اکنون",
        "user": user, "remaining_days": 30, "data_limit_gb": 50,
        "today_traffic": user["data_used"],
        "settings": {"token": "token", "admin_id": "123", "enabled": True},
        "admin_username": "admin", "config_link": "vless://example",
        "host": "example.com", "is_active": True, "reason": "",
        "data_used_gb": 12, "usage_percent": 24,
    }


class UIContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html", "xml"]))
        cls.context = render_context()

    def render(self, name, **updates):
        context = dict(self.context)
        context.update(updates)
        return self.env.get_template(name).render(**context)

    def test_all_templates_render(self):
        expected = {"base.html", "dashboard.html", "users.html", "add_user.html", "edit_user.html", "traffic.html", "telegram.html", "settings.html", "login.html", "sub.html"}
        self.assertEqual({path.name for path in TEMPLATES.glob("*.html")}, expected)
        for template in sorted(expected):
            with self.subTest(template=template):
                self.assertTrue(self.render(template).strip())
        inactive = user_fixture("expired")
        self.assertIn("سرویس غیرفعال است", self.render("sub.html", user=inactive, is_active=False, reason="سرویس منقضی شده", config_link=""))

    def test_navigation_order_is_stable(self):
        source = (TEMPLATES / "base.html").read_text(encoding="utf-8")
        nav = source.split('<nav class="nav module-nav">', 1)[1].split("</nav>", 1)[0]
        labels = ["داشبورد", "کاربران", "ساخت کاربر", "مصرف ترافیک", "بات تلگرام", "تنظیمات"]
        positions = [nav.index(label) for label in labels]
        self.assertEqual(positions, sorted(positions))
        routes = ["/dashboard", "/users", "/users/add", "/traffic", "/telegram", "/settings"]
        route_positions = [nav.index(f'href="{route}"') for route in routes]
        self.assertEqual(route_positions, sorted(route_positions))

    def test_form_contracts(self):
        contracts = {
            ("add_user.html", "/users/add"): ["username", "description", "data_limit", "expiry_days", "ip_limit", "protocol", "flow", "telegram_id", "note"],
            ("edit_user.html", "/users/edit/11111111-2222-3333-4444-555555555555"): ["username", "description", "status", "data_limit", "expiry_days", "ip_limit", "protocol", "flow", "telegram_id", "note"],
            ("telegram.html", "/telegram/save"): ["token", "admin_id", "enabled"],
            ("telegram.html", "/telegram/test"): ["token", "admin_id"],
            ("settings.html", "/settings/change-credentials"): ["current_password", "new_username", "new_password", "confirm_password"],
            ("settings.html", "/settings/restore"): ["backup_file"],
            ("login.html", "/login"): ["username", "password"],
        }
        for (template, action), expected_names in contracts.items():
            with self.subTest(template=template, action=action):
                parser = FormCollector()
                parser.feed(self.render(template))
                form = next((item for item in parser.forms if item["action"] == action), None)
                self.assertIsNotNone(form)
                self.assertEqual(form["names"], expected_names)

    def test_local_critical_assets_exist(self):
        required = [
            STATIC / "style.css", STATIC / "sub.css", STATIC / "app.js",
            STATIC / "logo.webp", STATIC / "favicon.png", STATIC / "qrcode.min.js",
            STATIC / "fonts" / "vazirmatn.woff2", STATIC / "fonts" / "OFL.txt",
            ROOT / "THIRD_PARTY_LICENSES.md",
        ]
        for path in required:
            with self.subTest(path=path):
                self.assertTrue(path.is_file() and path.stat().st_size > 0)
        self.assertFalse((STATIC / "logo.jpg").exists())

    def test_no_runtime_ui_cdn_dependencies(self):
        content = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for directory in (TEMPLATES, STATIC) for path in directory.rglob("*") if path.suffix in {".html", ".css", ".js"})
        self.assertNotIn("fonts.googleapis.com", content)
        self.assertNotIn("fonts.gstatic.com", content)
        self.assertNotIn("cdn.jsdelivr.net", content)
        self.assertNotIn("api.dicebear.com", content)
        self.assertNotIn("chart.js", content.lower())


if __name__ == "__main__":
    unittest.main()
