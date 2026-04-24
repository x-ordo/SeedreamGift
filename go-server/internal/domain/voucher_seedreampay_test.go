package domain

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVoucherCode_HasSeedreampayFields(t *testing.T) {
	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	orderID := 42
	ip := "203.0.113.7"

	vc := VoucherCode{
		SerialNo:        &serial,
		SecretHash:      &hash,
		RedeemedOrderID: &orderID,
		RedeemedIP:      &ip,
	}

	require.Equal(t, "SEED-10K1-X7AB-K9PD-M3QY", *vc.SerialNo)
	require.Equal(t, 64, len(*vc.SecretHash))
	require.Equal(t, 42, *vc.RedeemedOrderID)
	require.Equal(t, "203.0.113.7", *vc.RedeemedIP)
}

// SecretHash must never appear in JSON output (security requirement).
func TestVoucherCode_SecretHash_NotSerialized(t *testing.T) {
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	vc := VoucherCode{SecretHash: &hash}
	b, err := json.Marshal(vc)
	require.NoError(t, err)
	require.NotContains(t, string(b), "secretHash")
	require.NotContains(t, string(b), hash)
}
