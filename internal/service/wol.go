package service

import (
	"encoding/hex"
	"fmt"
	"net"
	"strings"
)

// WakeOnLAN sends a magic packet to wake up a device on the local network.
// mac should be in the format "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF".
func WakeOnLAN(mac string) error {
	// Strip separators and parse hex
	cleaned := strings.NewReplacer(":", "", "-", "", ".", "").Replace(mac)
	if len(cleaned) != 12 {
		return fmt.Errorf("无效的 MAC 地址: %s", mac)
	}

	macBytes, err := hex.DecodeString(cleaned)
	if err != nil {
		return fmt.Errorf("MAC 地址解析失败: %w", err)
	}

	// Build magic packet: 6 bytes of 0xFF + 16 repetitions of the MAC
	packet := make([]byte, 102)
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 1; i <= 16; i++ {
		copy(packet[i*6:], macBytes)
	}

	// Send UDP broadcast to port 9
	conn, err := net.DialUDP("udp", nil, &net.UDPAddr{IP: net.IPv4bcast, Port: 9})
	if err != nil {
		return fmt.Errorf("UDP 连接失败: %w", err)
	}
	defer conn.Close()

	// Set broadcast flag explicitly (some systems need this)
	if err := conn.SetWriteBuffer(102); err != nil {
		return fmt.Errorf("设置写缓冲区失败: %w", err)
	}

	_, err = conn.Write(packet)
	if err != nil {
		return fmt.Errorf("发送魔法包失败: %w", err)
	}

	return nil
}
