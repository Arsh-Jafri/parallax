package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/arsh/parallax/ingestion/connectors"
	rdb "github.com/arsh/parallax/ingestion/redis"
)

func fetchGeminiPairs() (map[string]bool, error) {
	resp, err := http.Get("https://api.gemini.com/v1/symbols")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var syms []string
	if err := json.Unmarshal(body, &syms); err != nil {
		return nil, err
	}
	out := map[string]bool{}
	for _, s := range syms {
		if !strings.HasSuffix(s, "usd") || strings.HasSuffix(s, "gusd") {
			continue
		}
		base := strings.ToUpper(s[:len(s)-3])
		if len(base) >= 2 && len(base) <= 10 {
			out[base] = true
		}
	}
	return out, nil
}

func fetchCoinbasePairs() (map[string]bool, error) {
	resp, err := http.Get("https://api.exchange.coinbase.com/products")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var products []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(body, &products); err != nil {
		return nil, err
	}
	re := regexp.MustCompile(`^([A-Z0-9]+)-USD$`)
	out := map[string]bool{}
	for _, p := range products {
		if p.Status != "online" {
			continue
		}
		if m := re.FindStringSubmatch(p.ID); m != nil {
			out[m[1]] = true
		}
	}
	return out, nil
}

func fetchKrakenPairs() (map[string]bool, error) {
	resp, err := http.Get("https://api.kraken.com/0/public/AssetPairs")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Result map[string]struct {
			WSName string `json:"wsname"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	re := regexp.MustCompile(`^([A-Z0-9]+)/USD$`)
	out := map[string]bool{}
	for _, pair := range result.Result {
		if m := re.FindStringSubmatch(pair.WSName); m != nil {
			sym := m[1]
			if sym == "XBT" {
				sym = "BTC"
			}
			out[sym] = true
		}
	}
	return out, nil
}

func intersection(a, b, c map[string]bool) []string {
	var result []string
	for k := range a {
		if b[k] && c[k] {
			result = append(result, k)
		}
	}
	return result
}

// fallbackPairs used if REST API fetches fail
var fallbackPairs = []string{
	"BTC", "ETH", "SOL", "AVAX", "LINK", "MATIC", "UNI", "AAVE",
	"DOT", "ADA", "LTC", "BCH", "XLM", "ATOM", "NEAR",
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.LUTC)
	log.SetOutput(os.Stderr)

	log.Println("[main] starting Parallax ingestion service")

	redisClient := rdb.NewClient()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Fetch pair intersection
	log.Println("[main] fetching pair intersection from exchanges…")
	pairs := fallbackPairs

	ctx2, cancel2 := context.WithTimeout(ctx, 10*time.Second)
	defer cancel2()
	_ = ctx2

	gemini, err1 := fetchGeminiPairs()
	coinbase, err2 := fetchCoinbasePairs()
	kraken, err3 := fetchKrakenPairs()

	if err1 != nil {
		log.Printf("[main] gemini REST error: %v", err1)
	}
	if err2 != nil {
		log.Printf("[main] coinbase REST error: %v", err2)
	}
	if err3 != nil {
		log.Printf("[main] kraken REST error: %v", err3)
	}

	if err1 == nil && err2 == nil && err3 == nil {
		intersected := intersection(gemini, coinbase, kraken)
		if len(intersected) > 0 {
			pairs = intersected
			log.Printf("[main] pair intersection: %d pairs", len(pairs))
		}
	} else {
		log.Printf("[main] using fallback pair list (%d pairs)", len(fallbackPairs))
	}

	// Write pairs:available to Redis
	pairsJSON, _ := json.Marshal(pairs)
	if err := rdb.SetPairs(ctx, redisClient, pairsJSON); err != nil {
		log.Printf("[main] failed to write pairs:available: %v", err)
	}

	fmt.Printf("[main] watching %d pairs: %s\n", len(pairs), strings.Join(pairs[:min(5, len(pairs))], ", ")+"…")

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		connectors.RunGemini(ctx, pairs, redisClient)
	}()
	go func() {
		defer wg.Done()
		connectors.RunCoinbase(ctx, pairs, redisClient)
	}()
	go func() {
		defer wg.Done()
		connectors.RunKraken(ctx, pairs, redisClient)
	}()

	<-ctx.Done()
	log.Println("[main] shutting down…")
	wg.Wait()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
