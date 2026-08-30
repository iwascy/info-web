package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type ingestScopeKey struct{}

type IngestIntegration struct {
	ServiceKey  string  `json:"service_key"`
	Name        string  `json:"name"`
	TokenPrefix string  `json:"token_prefix"`
	CreatedAt   string  `json:"created_at"`
	LastUsedAt  *string `json:"last_used_at"`
	RevokedAt   *string `json:"revoked_at"`
	Token       string  `json:"token,omitempty"`
}

func withIngestScope(r *http.Request, serviceKey string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ingestScopeKey{}, serviceKey))
}

func ingestScope(r *http.Request) string {
	value, _ := r.Context().Value(ingestScopeKey{}).(string)
	return value
}

func requireIngestService(w http.ResponseWriter, r *http.Request, serviceKey string) bool {
	scope := ingestScope(r)
	if scope != "" && scope != serviceKey {
		writeErr(w, http.StatusForbidden, "token is not authorized for this service_key")
		return false
	}
	return true
}

func requireGlobalIngest(w http.ResponseWriter, r *http.Request) bool {
	if ingestScope(r) != "" {
		writeErr(w, http.StatusForbidden, "endpoint requires the global ingest token")
		return false
	}
	return true
}

func (a *App) authenticateIngestToken(token string) (string, bool) {
	global := a.currentToken()
	if token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(global)) == 1 {
		return "", true
	}
	if token == "" {
		return "", false
	}
	hash := hashIngestToken(token)
	var serviceKey string
	err := a.db.QueryRow("SELECT service_key FROM ingest_integrations WHERE token_hash=? AND revoked_at IS NULL", hash).Scan(&serviceKey)
	if err != nil {
		return "", false
	}
	_, _ = a.db.Exec("UPDATE ingest_integrations SET last_used_at=? WHERE service_key=?", time.Now().UTC().Format(time.RFC3339), serviceKey)
	return serviceKey, true
}

func (a *App) getIntegrations(w http.ResponseWriter, _ *http.Request) {
	rows, err := a.db.Query("SELECT service_key,name,token_prefix,created_at,last_used_at,revoked_at FROM ingest_integrations ORDER BY service_key")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := []IngestIntegration{}
	for rows.Next() {
		var item IngestIntegration
		if err := rows.Scan(&item.ServiceKey, &item.Name, &item.TokenPrefix, &item.CreatedAt, &item.LastUsedAt, &item.RevokedAt); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		items = append(items, item)
	}
	writeJSON(w, items)
}

func (a *App) createIntegration(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ServiceKey string `json:"service_key"`
		Name       string `json:"name"`
	}
	if !decode(w, r, &input) {
		return
	}
	input.ServiceKey = strings.TrimSpace(input.ServiceKey)
	input.Name = strings.TrimSpace(input.Name)
	if input.ServiceKey == "" || len(input.ServiceKey) > 128 {
		writeErr(w, http.StatusBadRequest, "service_key is required and must not exceed 128 characters")
		return
	}
	if input.Name == "" {
		input.Name = input.ServiceKey
	}
	var exists int
	if err := a.db.QueryRow("SELECT COUNT(*) FROM ingest_integrations WHERE service_key=?", input.ServiceKey).Scan(&exists); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if exists > 0 {
		writeErr(w, http.StatusConflict, "integration already exists; rotate its token explicitly")
		return
	}
	a.issueIntegrationToken(w, input.ServiceKey, input.Name)
}

func (a *App) rotateIntegration(w http.ResponseWriter, r *http.Request) {
	serviceKey := strings.TrimSpace(chi.URLParam(r, "key"))
	var name string
	if serviceKey == "" || a.db.QueryRow("SELECT name FROM ingest_integrations WHERE service_key=?", serviceKey).Scan(&name) != nil {
		writeErr(w, http.StatusNotFound, "integration not found")
		return
	}
	a.issueIntegrationToken(w, serviceKey, name)
}

func (a *App) issueIntegrationToken(w http.ResponseWriter, serviceKey, name string) {
	token, err := generateIntegrationToken()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = a.db.Exec(`INSERT INTO ingest_integrations(service_key,name,token_hash,token_prefix,created_at,revoked_at)
VALUES(?,?,?,?,?,NULL)
ON CONFLICT(service_key) DO UPDATE SET name=excluded.name,token_hash=excluded.token_hash,token_prefix=excluded.token_prefix,created_at=excluded.created_at,last_used_at=NULL,revoked_at=NULL`,
		serviceKey, name, hashIngestToken(token), token[:12], now)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = a.ensureService(serviceKey, name, "sync")
	writeJSON(w, IngestIntegration{ServiceKey: serviceKey, Name: name, TokenPrefix: token[:12], CreatedAt: now, Token: token})
}

func (a *App) revokeIntegration(w http.ResponseWriter, r *http.Request) {
	serviceKey := strings.TrimSpace(chi.URLParam(r, "key"))
	result, err := a.db.Exec("UPDATE ingest_integrations SET revoked_at=? WHERE service_key=? AND revoked_at IS NULL", time.Now().UTC().Format(time.RFC3339), serviceKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	changed, _ := result.RowsAffected()
	if changed == 0 {
		writeErr(w, http.StatusNotFound, "active integration not found")
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

func generateIntegrationToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "opi_" + hex.EncodeToString(buf), nil
}

func hashIngestToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
