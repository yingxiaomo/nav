package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/YingXiaoMo/nav/internal/model"
	"github.com/YingXiaoMo/nav/internal/remote"
)

// SSHExecRequest SSH 执行请求
type SSHExecRequest struct {
	Host    string `json:"host"`
	User    string `json:"user"`
	Pass    string `json:"pass"`
	Port    int    `json:"port,omitempty"`
	Command string `json:"command"`
}

// SSHExecResponse SSH 执行响应
type SSHExecResponse struct {
	Output string `json:"output"`
}

// SSHExec handles POST /api/v1/ssh/exec — 远程 SSH 命令执行（⌘K /ssh 用）
func (h *Handler) SSHExec() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SSHExecRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Command == "" {
			model.RespondError(w, http.StatusBadRequest, "请提供 SSH 连接信息和命令")
			return
		}

		port := req.Port
		if port == 0 {
			port = 22
		}
		addr := req.Host + ":" + strconv.Itoa(port)

		exec := remote.NewSSHExec()
		output, err := exec.ExecSSH(addr, req.User, req.Pass, req.Command)
		if err != nil {
			slog.Error("SSH 执行失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "SSH 执行失败: "+err.Error())
			return
		}

		model.RespondJSON(w, http.StatusOK, SSHExecResponse{Output: output})
	}
}
