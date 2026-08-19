package model

import (
	"encoding/json"
	"io"
	"net/http"
)

type APIError struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

func RespondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, APIError{Error: http.StatusText(status), Message: message})
}

// DecodeJSON 解析请求体 JSON 到 dst。
// 返回 false 表示解析失败（不写响应，由调用方决定错误消息与状态码）。
// 供各 handler 复用，替代手写 json.NewDecoder(r.Body).Decode 样板。
func DecodeJSON(r *http.Request, dst any) bool {
	return json.NewDecoder(io.LimitReader(r.Body, 10<<20)).Decode(dst) == nil
}
