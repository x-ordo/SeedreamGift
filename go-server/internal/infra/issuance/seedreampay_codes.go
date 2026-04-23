package issuance

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/crc32"
	"math/big"
)

// serialAlphabet is 30 characters: Crockford Base32 minus 0/O/1/I/L/U (ambiguous).
const serialAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

// ErrUnknownFaceValue is returned when GenerateSerialNo receives an unsupported face value.
var ErrUnknownFaceValue = errors.New("unknown face value")

// faceValueTag maps Seedreampay denominations to their 4-char visible tag. Spec §5.1.
var faceValueTag = map[int]string{
	1000:   "1K01",
	10000:  "10K1",
	100000: "100K",
	500000: "500K",
}

// GenerateSerialNo produces a public voucher code of the form
//
//	SEED-{tag}-{nnnn}-{nnnn}-{cccc}
//
// where tag is a face-value-derived visible identifier, nnnn groups are
// crypto/rand characters from a 30-char ambiguity-free alphabet, and cccc
// is a CRC32-derived checksum over the preceding body.
func GenerateSerialNo(faceValue int) (string, error) {
	tag, ok := faceValueTag[faceValue]
	if !ok {
		return "", fmt.Errorf("%w: %d", ErrUnknownFaceValue, faceValue)
	}
	r1, err := randomChars(4)
	if err != nil {
		return "", err
	}
	r2, err := randomChars(4)
	if err != nil {
		return "", err
	}
	body := fmt.Sprintf("SEED-%s-%s-%s", tag, r1, r2)
	checksum := checksumChars(crc32.ChecksumIEEE([]byte(body)), 4)
	return body + "-" + checksum, nil
}

func randomChars(n int) (string, error) {
	out := make([]byte, n)
	max := big.NewInt(int64(len(serialAlphabet)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		out[i] = serialAlphabet[idx.Int64()]
	}
	return string(out), nil
}

func checksumChars(sum uint32, n int) string {
	out := make([]byte, n)
	base := uint32(len(serialAlphabet))
	for i := 0; i < n; i++ {
		out[i] = serialAlphabet[sum%base]
		sum /= base
	}
	return string(out)
}

// GenerateSecret returns a 12-digit numeric secret drawn uniformly from [0, 10^12).
// The raw secret is returned once and must never be persisted — store SecretHash instead.
func GenerateSecret() (string, error) {
	max := big.NewInt(1_000_000_000_000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%012d", n.Int64()), nil
}

// SecretHash computes the peppered SHA-256 used to verify a Seedreampay
// voucher's secret. The salt is the public SerialNo so that identical secrets
// across different vouchers produce distinct hashes.
func SecretHash(secret, serialNo string) string {
	h := sha256.Sum256([]byte(secret + ":" + serialNo))
	return hex.EncodeToString(h[:])
}
