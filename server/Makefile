.PHONY: build run dev

build:
	go build -o bin/server cmd/main.go

run: build
	./bin/server

dev:
	go run cmd/main.go
