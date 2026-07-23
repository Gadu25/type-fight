package main

import (
	"log"
	"net/http"
	"os"

	"github.com/type-fight/server/internal/api"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

func main() {
	roomManager := game.NewRoomManager()
	hub := ws.NewHub()
	go hub.Run()

	handler := ws.NewHandler(hub, roomManager)
	routes := api.NewRoutes(roomManager, hub, handler)

	mux := http.NewServeMux()
	routes.Setup(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
