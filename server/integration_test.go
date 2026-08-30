package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestScopedIntegrationTokenOnlyWritesItsService(t *testing.T) {
	app := newTestApp(t)
	createReq := httptest.NewRequest(http.MethodPost, "/api/integrations", strings.NewReader(`{"service_key":"project-a","name":"Project A"}`))
	createRes := httptest.NewRecorder()
	app.createIntegration(createRes, createReq)
	if createRes.Code != http.StatusOK {
		t.Fatalf("create integration: %d %s", createRes.Code, createRes.Body.String())
	}
	var integration IngestIntegration
	if err := json.NewDecoder(createRes.Body).Decode(&integration); err != nil {
		t.Fatal(err)
	}
	if integration.Token == "" || strings.Contains(integration.TokenPrefix, integration.Token) {
		t.Fatalf("unexpected issued token: %+v", integration)
	}

	handler := app.ingestAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			ServiceKey string `json:"service_key"`
		}
		if !decode(w, r, &payload) {
			return
		}
		if !requireIngestService(w, r, payload.ServiceKey) {
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	}))

	allowed := httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(`{"service_key":"project-a"}`))
	allowed.Header.Set("Authorization", "Bearer "+integration.Token)
	allowedRes := httptest.NewRecorder()
	handler.ServeHTTP(allowedRes, allowed)
	if allowedRes.Code != http.StatusOK {
		t.Fatalf("scoped token rejected own service: %d %s", allowedRes.Code, allowedRes.Body.String())
	}

	denied := httptest.NewRequest(http.MethodPost, "/api/progress", strings.NewReader(`{"service_key":"project-b"}`))
	denied.Header.Set("Authorization", "Bearer "+integration.Token)
	deniedRes := httptest.NewRecorder()
	handler.ServeHTTP(deniedRes, denied)
	if deniedRes.Code != http.StatusForbidden {
		t.Fatalf("scoped token wrote another service: %d %s", deniedRes.Code, deniedRes.Body.String())
	}
}

func TestRotatingIntegrationRevokesPreviousToken(t *testing.T) {
	app := newTestApp(t)
	first := issueTestIntegration(t, app, "project-a")
	router := chi.NewRouter()
	router.Post("/api/integrations/{key}/rotate", app.rotateIntegration)
	req := httptest.NewRequest(http.MethodPost, "/api/integrations/project-a/rotate", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	var rotated IngestIntegration
	if err := json.NewDecoder(res.Body).Decode(&rotated); err != nil {
		t.Fatal(err)
	}
	second := rotated.Token
	if first == second {
		t.Fatal("rotation returned the same token")
	}
	if _, ok := app.authenticateIngestToken(first); ok {
		t.Fatal("previous token still authenticates after rotation")
	}
	if scope, ok := app.authenticateIngestToken(second); !ok || scope != "project-a" {
		t.Fatalf("rotated token did not authenticate: scope=%q ok=%v", scope, ok)
	}
}

func issueTestIntegration(t *testing.T, app *App, serviceKey string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/integrations", strings.NewReader(`{"service_key":"`+serviceKey+`","name":"Test"}`))
	res := httptest.NewRecorder()
	app.createIntegration(res, req)
	var integration IngestIntegration
	if err := json.NewDecoder(res.Body).Decode(&integration); err != nil {
		t.Fatal(err)
	}
	return integration.Token
}
