package handler

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"github.com/YingXiaoMo/nav/internal/model"
)

// magic number signatures for supported image types
var magicDetectors = []struct {
	sig []byte
	ext string
}{
	{[]byte{0xFF, 0xD8, 0xFF}, "jpg"},
	{[]byte{0x89, 0x50, 0x4E, 0x47}, "png"},
	{[]byte{0x47, 0x49, 0x46, 0x38}, "gif"},
	{[]byte{0x52, 0x49, 0x46, 0x46}, "webp"},
}

func detectImageExt(head []byte) string {
	for _, d := range magicDetectors {
		if len(head) < len(d.sig) {
			continue
		}
		match := true
		for i, b := range d.sig {
			if head[i] != b {
				match = false
				break
			}
		}
		if !match {
			continue
		}
		// WebP: bytes 8-11 must be "WEBP"
		if d.ext == "webp" && len(head) >= 12 {
			if string(head[8:12]) != "WEBP" {
				continue
			}
		}
		return d.ext
	}
	return ""
}

// Upload handles POST /api/v1/upload — file upload with magic number detection.
func Upload(uploadDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Limit request body to 10 MB
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

		// 2. Parse multipart form
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			slog.Error("解析上传文件失败", "error", err)
			model.RespondError(w, http.StatusBadRequest, "文件上传失败，文件可能过大")
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			slog.Error("获取上传文件失败", "error", err)
			model.RespondError(w, http.StatusBadRequest, "请选择文件")
			return
		}
		defer file.Close()

		// 3. Read first 512 bytes for magic number detection
		head := make([]byte, 512)
		n, err := io.ReadAtLeast(file, head, 1)
		if err != nil && err != io.ErrUnexpectedEOF {
			if err == io.EOF {
				model.RespondError(w, http.StatusBadRequest, "文件为空")
				return
			}
			slog.Error("读取文件头失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "读取文件失败")
			return
		}
		head = head[:n]

		ext := detectImageExt(head)
		if ext == "" {
			model.RespondError(w, http.StatusBadRequest, "不支持的文件格式，仅接受 jpg/png/gif/webp 图片")
			return
		}

		// 4. Generate unique filename
		filename := model.NewID() + "." + ext

		// 5. Write to upload directory (write head first, then copy remaining)
		dst := filepath.Join(uploadDir, filename)
		out, err := os.Create(dst)
		if err != nil {
			slog.Error("创建文件失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存文件失败")
			return
		}
		defer out.Close()

		if _, err := out.Write(head); err != nil {
			slog.Error("写入文件失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存文件失败")
			return
		}
		if _, err := io.Copy(out, file); err != nil {
			slog.Error("写入文件失败", "error", err)
			model.RespondError(w, http.StatusInternalServerError, "保存文件失败")
			return
		}

		// 6. Return URL
		resp := map[string]any{
			"url":      "/uploads/" + filename,
			"filename": filename,
		}
		model.RespondJSON(w, http.StatusCreated, resp)
	}
}
