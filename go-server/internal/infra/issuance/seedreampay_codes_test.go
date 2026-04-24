package issuance

import (
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// NOTE: alphabet is 30 chars (0/O/1/I/L/U excluded). The character class captures it.
var serialPattern = regexp.MustCompile(`^SEED-(1K01|10K1|100K|500K)-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$`)

func TestGenerateSerialNo_FormatByFaceValue(t *testing.T) {
	cases := map[int]string{
		1000:   "1K01",
		10000:  "10K1",
		100000: "100K",
		500000: "500K",
	}
	for faceValue, wantTag := range cases {
		got, err := GenerateSerialNo(faceValue)
		require.NoError(t, err)
		require.True(t, serialPattern.MatchString(got), "unexpected format: %s", got)
		require.Contains(t, got, "-"+wantTag+"-", "tag mismatch for %d: %s", faceValue, got)
	}
}

func TestGenerateSerialNo_UnknownFaceValue(t *testing.T) {
	_, err := GenerateSerialNo(7777)
	require.ErrorIs(t, err, ErrUnknownFaceValue)
}

func TestGenerateSerialNo_NoAmbiguousChars(t *testing.T) {
	forbidden := []string{"0", "O", "I", "L", "U"}
	for i := 0; i < 200; i++ {
		serial, err := GenerateSerialNo(10000)
		require.NoError(t, err)
		random := strings.TrimPrefix(serial, "SEED-10K1-")
		random = strings.ReplaceAll(random, "-", "")
		for _, f := range forbidden {
			require.NotContains(t, random, f, "forbidden char %s in %s", f, serial)
		}
	}
}

func TestGenerateSecret_Length12Numeric(t *testing.T) {
	re := regexp.MustCompile(`^\d{12}$`)
	for i := 0; i < 100; i++ {
		s, err := GenerateSecret()
		require.NoError(t, err)
		require.True(t, re.MatchString(s), "expected 12-digit numeric, got: %s", s)
	}
}

func TestGenerateSecret_Distribution(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		s, err := GenerateSecret()
		require.NoError(t, err)
		seen[s] = true
	}
	require.GreaterOrEqual(t, len(seen), 98)
}

func TestSecretHash_Deterministic(t *testing.T) {
	h1 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	h2 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	require.Equal(t, h1, h2)
	require.Len(t, h1, 64)
}

func TestSecretHash_DifferentSerialDifferentHash(t *testing.T) {
	h1 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	h2 := SecretHash("482917365021", "SEED-10K1-XXXX-YYYY-ZZZZ")
	require.NotEqual(t, h1, h2)
}
