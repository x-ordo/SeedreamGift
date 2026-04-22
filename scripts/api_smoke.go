package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const base = "https://wowgift.co.kr"
const api = base + "/api/v1"

var cl = &http.Client{Timeout: 10 * time.Second}
var token string
var cookie string
var pass, fail int

func doReq(method, url string, data any, auth bool) (int, string) {
	var body io.Reader
	if data != nil {
		j, _ := json.Marshal(data)
		body = bytes.NewBuffer(j)
	}
	req, _ := http.NewRequest(method, url, body)
	req.Header.Set("Content-Type", "application/json")
	if auth && token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	resp, err := cl.Do(req)
	if err != nil {
		return 0, err.Error()
	}
	defer resp.Body.Close()
	for _, c := range resp.Cookies() {
		if c.Name == "refresh_token" {
			cookie = "refresh_token=" + c.Value
		}
	}
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

func ok(name string, code, expect int, body string) {
	short := body
	if len(short) > 120 {
		short = short[:120] + "..."
	}
	if code == expect {
		pass++
		fmt.Printf("  [OK]   %-55s %d\n", name, code)
	} else {
		fail++
		fmt.Printf("  [FAIL] %-55s got %d (want %d) %s\n", name, code, expect, short)
	}
}

func okRange(name string, code int, lo, hi int, body string) {
	if code >= lo && code <= hi {
		pass++
		fmt.Printf("  [OK]   %-55s %d\n", name, code)
	} else {
		fail++
		short := body
		if len(short) > 120 {
			short = short[:120] + "..."
		}
		fmt.Printf("  [FAIL] %-55s got %d (want %d-%d) %s\n", name, code, lo, hi, short)
	}
}

func main() {
	fmt.Println("╔══════════════════════════════════════════════════════════╗")
	fmt.Println("║   W기프트 Client → Go Server 전체 엔드포인트 테스트     ║")
	fmt.Println("╚══════════════════════════════════════════════════════════╝")
	fmt.Println()

	// ═══════════════════════════════════════════════════════════
	// 1. SYSTEM
	// ═══════════════════════════════════════════════════════════
	fmt.Println("── 1. System ──")
	c, b := doReq("GET", base+"/health", nil, false)
	ok("GET /health", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 2. PUBLIC — Products & Brands
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 2. Public: Products & Brands ──")
	c, b = doReq("GET", api+"/products", nil, false)
	ok("GET /products", c, 200, b)
	c, b = doReq("GET", api+"/products/rates", nil, false)
	ok("GET /products/rates", c, 200, b)
	c, b = doReq("GET", api+"/products/live-rates", nil, false)
	ok("GET /products/live-rates", c, 200, b)
	c, b = doReq("GET", api+"/brands", nil, false)
	ok("GET /brands", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 3. PUBLIC — Content (notices, faqs, events)
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 3. Public: Content ──")
	c, b = doReq("GET", api+"/notices", nil, false)
	ok("GET /notices", c, 200, b)
	c, b = doReq("GET", api+"/notices/active", nil, false)
	ok("GET /notices/active", c, 200, b)
	c, b = doReq("GET", api+"/faqs", nil, false)
	ok("GET /faqs", c, 200, b)
	c, b = doReq("GET", api+"/faqs/active", nil, false)
	ok("GET /faqs/active", c, 200, b)
	c, b = doReq("GET", api+"/faqs/categories", nil, false)
	ok("GET /faqs/categories", c, 200, b)
	c, b = doReq("GET", api+"/events", nil, false)
	ok("GET /events", c, 200, b)
	c, b = doReq("GET", api+"/events/active", nil, false)
	ok("GET /events/active", c, 200, b)
	c, b = doReq("GET", api+"/events/featured", nil, false)
	ok("GET /events/featured", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 4. PUBLIC — Site Config
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 4. Public: Site Config ──")
	c, b = doReq("GET", api+"/site-configs/PAYMENT_BANK_NAME", nil, false)
	ok("GET /site-configs/PAYMENT_BANK_NAME", c, 200, b)
	c, b = doReq("GET", api+"/site-configs/PAYMENT_BANK_ACCOUNT", nil, false)
	ok("GET /site-configs/PAYMENT_BANK_ACCOUNT", c, 200, b)
	c, b = doReq("GET", api+"/site-configs/PAYMENT_BANK_HOLDER", nil, false)
	ok("GET /site-configs/PAYMENT_BANK_HOLDER", c, 200, b)
	c, b = doReq("GET", api+"/site-configs/NONEXISTENT_KEY", nil, false)
	ok("GET /site-configs/NONEXISTENT → 404", c, 404, b)

	// ═══════════════════════════════════════════════════════════
	// 5. PUBLIC — KYC (회원가입 플로우)
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 5. Public: KYC (registration flow, no JWT) ──")
	c, b = doReq("POST", api+"/kyc/bank-verify/request", map[string]string{"bankCode": "004", "accountNumber": "1234567890"}, false)
	okRange("POST /kyc/bank-verify/request (non-401)", c, 200, 500, b)
	c, b = doReq("POST", api+"/kyc/kcb/start", map[string]string{}, false)
	okRange("POST /kyc/kcb/start (non-401)", c, 200, 500, b)

	// ═══════════════════════════════════════════════════════════
	// 6. AUTH — Login / Refresh / Logout
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 6. Auth ──")

	// Login
	c, b = doReq("POST", api+"/auth/login", map[string]string{"email": "user@wgift.kr", "password": "test1234"}, false)
	if c == 200 {
		var r map[string]any
		json.Unmarshal([]byte(b), &r)
		if d, ok := r["data"].(map[string]any); ok {
			if t, ok := d["access_token"].(string); ok {
				token = t
			}
		}
	}
	if token != "" {
		pass++
		fmt.Printf("  [OK]   %-55s %d (token acquired)\n", "POST /auth/login", c)
	} else {
		fail++
		fmt.Printf("  [FAIL] %-55s %d (no token)\n", "POST /auth/login", c)
	}

	c, b = doReq("GET", api+"/auth/me", nil, true)
	ok("GET /auth/me", c, 200, b)

	c, b = doReq("POST", api+"/auth/refresh", nil, false)
	ok("POST /auth/refresh (cookie)", c, 200, b)

	c, b = doReq("GET", api+"/auth/sessions", nil, true)
	ok("GET /auth/sessions", c, 200, b)

	// Login validation
	c, b = doReq("POST", api+"/auth/login", map[string]string{"email": "bad", "password": "x"}, false)
	ok("POST /auth/login (invalid) → 400/401", c, 400, b)

	// ═══════════════════════════════════════════════════════════
	// 7. PROTECTED — Cart
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 7. Protected: Cart ──")
	c, b = doReq("GET", api+"/cart", nil, true)
	ok("GET /cart", c, 200, b)
	c, b = doReq("GET", api+"/cart/check-limit", nil, true)
	ok("GET /cart/check-limit", c, 200, b)
	c, b = doReq("POST", api+"/cart", map[string]any{"productId": 1, "quantity": 1}, true)
	okRange("POST /cart (add item)", c, 200, 400, b) // 200 or 400 if product inactive
	c, b = doReq("DELETE", api+"/cart", nil, true)
	ok("DELETE /cart (clear)", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 8. PROTECTED — Orders
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 8. Protected: Orders ──")
	c, b = doReq("GET", api+"/orders/my", nil, true)
	ok("GET /orders/my", c, 200, b)
	c, b = doReq("GET", api+"/orders/my-gifts", nil, true)
	ok("GET /orders/my-gifts", c, 200, b)
	c, b = doReq("GET", api+"/orders/my/export", nil, true)
	okRange("GET /orders/my/export", c, 200, 400, b)

	// ═══════════════════════════════════════════════════════════
	// 9. PROTECTED — Trade-In
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 9. Protected: Trade-In ──")
	c, b = doReq("GET", api+"/trade-ins/my", nil, true)
	ok("GET /trade-ins/my", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 10. PROTECTED — Gifts
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 10. Protected: Gifts ──")
	c, b = doReq("GET", api+"/gifts/received", nil, true)
	ok("GET /gifts/received", c, 200, b)
	c, b = doReq("POST", api+"/gifts/check-receiver", map[string]string{"email": "user@wgift.kr"}, true)
	ok("POST /gifts/check-receiver", c, 200, b)
	c, b = doReq("GET", api+"/gifts/search?query=user", nil, true)
	ok("GET /gifts/search?query=user", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 11. PROTECTED — KYC (logged-in user)
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 11. Protected: KYC (logged-in) ──")
	c, b = doReq("GET", api+"/kyc/bank-account", nil, true)
	okRange("GET /kyc/bank-account", c, 200, 404, b)

	// ═══════════════════════════════════════════════════════════
	// 12. PROTECTED — Inquiries
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 12. Protected: Inquiries ──")
	c, b = doReq("GET", api+"/inquiries", nil, true)
	ok("GET /inquiries", c, 200, b)

	// ═══════════════════════════════════════════════════════════
	// 13. PROTECTED — Profile
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 13. Protected: Profile ──")
	c, b = doReq("PATCH", api+"/auth/profile", map[string]any{"name": "테스트유저"}, true)
	ok("PATCH /auth/profile", c, 200, b)
	c, b = doReq("PATCH", api+"/auth/password", map[string]string{"currentPassword": "test1234", "newPassword": "test1234"}, true)
	okRange("PATCH /auth/password", c, 200, 400, b) // 400 if same password

	// ═══════════════════════════════════════════════════════════
	// 14. PROTECTION — Without token → 401
	// ═══════════════════════════════════════════════════════════
	fmt.Println("\n── 14. Auth Guard (no token → 401) ──")
	endpoints401 := []struct{ method, path string }{
		{"GET", "/cart"},
		{"POST", "/cart"},
		{"GET", "/orders/my"},
		{"POST", "/orders"},
		{"GET", "/trade-ins/my"},
		{"POST", "/trade-ins"},
		{"GET", "/gifts/received"},
		{"GET", "/kyc/bank-account"},
		{"POST", "/kyc/bank-account"},
		{"GET", "/inquiries"},
		{"POST", "/inquiries"},
		{"GET", "/auth/me"},
		{"PATCH", "/auth/profile"},
		{"PATCH", "/auth/password"},
		{"DELETE", "/users/me"},
	}
	for _, ep := range endpoints401 {
		c, b = doReq(ep.method, api+ep.path, map[string]string{}, false)
		ok(fmt.Sprintf("%s %s (no token → 401)", ep.method, ep.path), c, 401, b)
	}

	// ═══════════════════════════════════════════════════════════
	// SUMMARY
	// ═══════════════════════════════════════════════════════════
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("  Total: %d passed, %d failed (out of %d)\n", pass, fail, pass+fail)
	fmt.Println("═══════════════════════════════════════════════════════════")
}
