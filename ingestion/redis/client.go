package redis

import (
	"context"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

func NewClient() *redis.Client {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		panic("invalid REDIS_URL: " + err.Error())
	}
	return redis.NewClient(opts)
}

func SetPrice(ctx context.Context, rdb *redis.Client, key string, val []byte) error {
	return rdb.Set(ctx, key, val, 5*time.Second).Err()
}

func SetPairs(ctx context.Context, rdb *redis.Client, val []byte) error {
	return rdb.Set(ctx, "pairs:available", val, time.Hour).Err()
}
