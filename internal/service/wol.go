package service

import (
	"encoding/hex"
	"fmt"
	"net"
	"strings"
)

// WakeOnLAN sends a magic packet to wake up a device on the local network.
// mac should be in the format "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF".
//
// 注意：UDP 广播包只能在同一二层网络内传播。Docker bridge 网络发出的
// 广播不会到达物理局域网——容器部署需要 network_mode: host 才能真正
// 唤醒 LAN 设备（容器内"发送成功"不代表设备收到了魔法包）。
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

	if _, err := conn.Write(packet); err != nil {
		return fmt.Errorf("发送魔法包失败: %w", err)
	}

	return nil
}
