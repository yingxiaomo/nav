package handler

import (
	"database/sql"

	"github.com/YingXiaoMo/nav/internal/service"
)

// Handler holds all dependencies for HTTP handlers.
type Handler struct {
	DB            *sql.DB
	HealthChecker *service.HealthChecker
	DockerSvc     *service.DockerService
	DockerMeta    *service.DockerMetadataStore
	UploadDir     string
	DataDir       string
}
