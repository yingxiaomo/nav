package model

import "testing"

func TestNewID(t *testing.T) {
	id1 := NewID()
	id2 := NewID()
	if id1 == "" {
		t.Error("NewID() should not return empty string")
	}
	if len(id1) != 21 {
		t.Errorf("NewID() length = %d, want 21", len(id1))
	}
	if id1 == id2 {
		t.Error("NewID() should produce unique IDs")
	}
}

func TestNow(t *testing.T) {
	now := Now()
	if now <= 0 {
		t.Error("Now() should return positive timestamp")
	}
}
