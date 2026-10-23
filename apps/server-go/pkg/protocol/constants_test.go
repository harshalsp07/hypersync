package protocol

import (
	"bytes"
	"testing"
)

func TestEncodeDecodeFrame(t *testing.T) {
	msgType := MsgCRDTSync
	flags := FlagEncrypted
	payload := []byte{0x01, 0x02, 0x03, 0x04}

	frame := EncodeFrame(msgType, flags, payload)
	if len(frame) != 2+len(payload) {
		t.Fatalf("expected frame len %d, got %d", 2+len(payload), len(frame))
	}

	decodedType, decodedFlags, decodedPayload, ok := DecodeFrame(frame)
	if !ok {
		t.Fatal("expected decode to succeed")
	}

	if decodedType != msgType {
		t.Errorf("expected type 0x%02x, got 0x%02x", msgType, decodedType)
	}

	if decodedFlags != flags {
		t.Errorf("expected flags 0x%02x, got 0x%02x", flags, decodedFlags)
	}

	if !bytes.Equal(decodedPayload, payload) {
		t.Errorf("payload mismatch: expected %v, got %v", payload, decodedPayload)
	}
}
