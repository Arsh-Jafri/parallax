package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	rdb "github.com/arsh/parallax/ingestion/redis"
	goredis "github.com/redis/go-redis/v9"
)

type geminiL2Update struct {
	Type    string `json:"type"`
	Changes [][]interface{} `json:"changes"`
}

// RunGemini connects to Gemini and streams best bid/ask for all pairs to Redis.
func RunGemini(ctx context.Context, pairs []string, redis *goredis.Client) {
	for {
		if err := runGeminiSession(ctx, pairs, redis); err != nil {
			log.Printf("[gemini] session error: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

func runGeminiSession(ctx context.Context, pairs []string, redisClient *goredis.Client) error {
	backoff := time.Second
	for _, pair := range pairs {
		go func(sym string) {
			for {
				if err := geminiConnectPair(ctx, sym, redisClient); err != nil {
					log.Printf("[gemini] %s error: %v", sym, err)
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
		}(pair)
	}
	<-ctx.Done()
	return nil
}

func geminiConnectPair(ctx context.Context, sym string, redisClient *goredis.Client) error {
	wsURL := fmt.Sprintf("wss://api.gemini.com/v1/marketdata/%susd", strings.ToLower(sym))
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	sub := map[string]interface{}{
		"type": "subscribe",
		"subscriptions": []map[string]interface{}{
			{"name": "l2", "symbols": []string{strings.ToLower(sym) + "usd"}},
		},
	}
	if err := conn.WriteJSON(sub); err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}

	bids := map[float64]float64{}
	asks := map[float64]float64{}

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
		var update geminiL2Update
		if err := json.Unmarshal(msg, &update); err != nil {
			continue
		}
		if update.Type != "l2_updates" {
			continue
		}
		for _, change := range update.Changes {
			if len(change) < 3 {
				continue
			}
			side, _ := change[0].(string)
			priceStr, _ := change[1].(string)
			qtyStr, _ := change[2].(string)
			var price, qty float64
			fmt.Sscanf(priceStr, "%f", &price)
			fmt.Sscanf(qtyStr, "%f", &qty)
			if qty == 0 {
				delete(bids, price)
				delete(asks, price)
			} else if side == "buy" {
				bids[price] = qty
			} else {
				asks[price] = qty
			}
		}

		bestBid := bestKey(bids, true)
		bestAsk := bestKey(asks, false)
		if bestBid == 0 || bestAsk == 0 {
			continue
		}

		tick := map[string]interface{}{
			"pair":      sym,
			"exchange":  "gemini",
			"bid":       bestBid,
			"ask":       bestAsk,
			"timestamp": time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(tick)
		key := fmt.Sprintf("price:gemini:%s", sym)
		if err := rdb.SetPrice(ctx, redisClient, key, data); err != nil {
			log.Printf("[gemini] redis write error: %v", err)
		}
	}
}

func bestKey(m map[float64]float64, highest bool) float64 {
	var best float64
	first := true
	for k := range m {
		if first || (highest && k > best) || (!highest && k < best) {
			best = k
			first = false
		}
	}
	return best
}
