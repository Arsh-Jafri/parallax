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

type cbSubscribeMsg struct {
	Type       string   `json:"type"`
	ProductIDs []string `json:"product_ids"`
	Channel    string   `json:"channel"`
}

type cbEvent struct {
	Channel string `json:"channel"`
	Events  []struct {
		Tickers []struct {
			ProductID string `json:"product_id"`
			BestBid   string `json:"best_bid"`
			BestAsk   string `json:"best_ask"`
		} `json:"tickers"`
	} `json:"events"`
}

// RunCoinbase connects to Coinbase Advanced Trade WS and streams prices to Redis.
func RunCoinbase(ctx context.Context, pairs []string, redisClient *goredis.Client) {
	backoff := time.Second
	for {
		if err := coinbaseSession(ctx, pairs, redisClient); err != nil {
			log.Printf("[coinbase] session error: %v", err)
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

func coinbaseSession(ctx context.Context, pairs []string, redisClient *goredis.Client) error {
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, "wss://advanced-trade-ws.coinbase.com", nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	productIDs := make([]string, len(pairs))
	for i, p := range pairs {
		productIDs[i] = p + "-USD"
	}

	sub := cbSubscribeMsg{
		Type:       "subscribe",
		ProductIDs: productIDs,
		Channel:    "ticker",
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
		var ev cbEvent
		if err := json.Unmarshal(msg, &ev); err != nil {
			continue
		}
		if ev.Channel != "ticker" {
			continue
		}
		for _, e := range ev.Events {
			for _, t := range e.Tickers {
				bid, errB := strconv.ParseFloat(t.BestBid, 64)
				ask, errA := strconv.ParseFloat(t.BestAsk, 64)
				if errB != nil || errA != nil || bid == 0 || ask == 0 {
					continue
				}
				// ProductID is like "BTC-USD"; extract base
				sym := t.ProductID
				if len(sym) > 4 && sym[len(sym)-4:] == "-USD" {
					sym = sym[:len(sym)-4]
				}
				tick := map[string]interface{}{
					"pair":      sym,
					"exchange":  "coinbase",
					"bid":       bid,
					"ask":       ask,
					"timestamp": time.Now().UnixMilli(),
				}
				data, _ := json.Marshal(tick)
				key := fmt.Sprintf("price:coinbase:%s", sym)
				if err := rdb.SetPrice(ctx, redisClient, key, data); err != nil {
					log.Printf("[coinbase] redis write error: %v", err)
				}
			}
		}
	}
}
