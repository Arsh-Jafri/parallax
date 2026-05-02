package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand/v2"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	rdb "github.com/arsh/parallax/ingestion/redis"
	goredis "github.com/redis/go-redis/v9"
)

// RunKraken connects to Kraken WS and streams prices to Redis.
// Kraken uses "XBT" internally; we map it back to "BTC".
func RunKraken(ctx context.Context, pairs []string, redisClient *goredis.Client) {
	backoff := time.Second
	for {
		if err := krakenSession(ctx, pairs, redisClient); err != nil {
			log.Printf("[kraken] session error: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		default:
			jitter := time.Duration(rand.IntN(400)) * time.Millisecond
			time.Sleep(backoff + jitter)
			if backoff < 30*time.Second {
				backoff *= 2
			}
		}
	}
}

func krakenSession(ctx context.Context, pairs []string, redisClient *goredis.Client) error {
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, "wss://ws.kraken.com", nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	wsPairs := make([]string, len(pairs))
	for i, p := range pairs {
		ws := p
		if ws == "BTC" {
			ws = "XBT"
		}
		wsPairs[i] = ws + "/USD"
	}

	sub := map[string]interface{}{
		"event": "subscribe",
		"pair":  wsPairs,
		"subscription": map[string]string{
			"name": "ticker",
		},
	}
	if err := conn.WriteJSON(sub); err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read: %w", err)
		}

		// Kraken ticker messages are arrays: [channelID, {b:[...], a:[...]}, "ticker", "XBT/USD"]
		var raw []json.RawMessage
		if err := json.Unmarshal(msg, &raw); err != nil {
			continue
		}
		if len(raw) != 4 {
			continue
		}
		var msgType string
		if err := json.Unmarshal(raw[2], &msgType); err != nil || msgType != "ticker" {
			continue
		}
		var wsPair string
		if err := json.Unmarshal(raw[3], &wsPair); err != nil {
			continue
		}

		var ticker struct {
			B []interface{} `json:"b"` // [price, wholeLotVol, lotVol]
			A []interface{} `json:"a"` // [price, wholeLotVol, lotVol]
		}
		if err := json.Unmarshal(raw[1], &ticker); err != nil {
			continue
		}
		if len(ticker.B) == 0 || len(ticker.A) == 0 {
			continue
		}

		bidStr, _ := ticker.B[0].(string)
		askStr, _ := ticker.A[0].(string)
		bid, errB := strconv.ParseFloat(bidStr, 64)
		ask, errA := strconv.ParseFloat(askStr, 64)
		if errB != nil || errA != nil || bid == 0 || ask == 0 {
			continue
		}

		// wsPair is like "XBT/USD" — extract base and normalise XBT→BTC
		sym := wsPair
		if len(wsPair) > 4 && wsPair[len(wsPair)-4:] == "/USD" {
			sym = wsPair[:len(wsPair)-4]
		}
		if sym == "XBT" {
			sym = "BTC"
		}

		tick := map[string]interface{}{
			"pair":      sym,
			"exchange":  "kraken",
			"bid":       bid,
			"ask":       ask,
			"timestamp": time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(tick)
		key := fmt.Sprintf("price:kraken:%s", sym)
		if err := rdb.SetPrice(ctx, redisClient, key, data); err != nil {
			log.Printf("[kraken] redis write error: %v", err)
		}
	}
}
