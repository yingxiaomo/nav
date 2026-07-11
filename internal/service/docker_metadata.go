package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/YingXiaoMo/nav/internal/model"
)

// DockerMetadataStore manages per-container metadata persisted in a JSON file.
type DockerMetadataStore struct {
	filePath string
	mu       sync.RWMutex
	data     map[string]model.DockerMetadata
}

// NewDockerMetadataStore creates a new store backed by the given file path.
func NewDockerMetadataStore(filePath string) *DockerMetadataStore {
	s := &DockerMetadataStore{
		filePath: filePath,
		data:     make(map[string]model.DockerMetadata),
	}
	s.load()
	return s
}

// load reads all metadata from the JSON file into memory.
func (s *DockerMetadataStore) load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return // will create on first write
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return // file doesn't exist yet
	}

	var store map[string]model.DockerMetadata
	if err := json.Unmarshal(data, &store); err != nil {
		return // corrupt file, start fresh
	}
	s.data = store
}

// save writes all metadata to the JSON file.
func (s *DockerMetadataStore) save() error {
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

// Get returns metadata for a specific container by name.
func (s *DockerMetadataStore) Get(name string) (model.DockerMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	meta, ok := s.data[name]
	if !ok {
		return model.DockerMetadata{}, os.ErrNotExist
	}
	return meta, nil
}

// Set saves metadata for a specific container by name.
func (s *DockerMetadataStore) Set(name string, meta model.DockerMetadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data[name] = meta
	return s.save()
}

// GetAll returns all stored container metadata.
// GetOrder returns the display order for a container name.
func (s *DockerMetadataStore) GetOrder(name string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if meta, ok := s.data[name]; ok {
		return meta.Order
	}
	return 999
}

func (s *DockerMetadataStore) GetAll() map[string]model.DockerMetadata {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to avoid race conditions
	result := make(map[string]model.DockerMetadata, len(s.data))
	for k, v := range s.data {
		result[k] = v
	}
	return result
}
